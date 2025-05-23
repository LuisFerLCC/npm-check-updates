import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import spawn from 'spawn-please'
import chaiSetup from './helpers/chaiSetup'
import stubVersions from './helpers/stubVersions'

chaiSetup()

const bin = path.join(__dirname, '../build/cli.js')

describe('rc-config', () => {
  // before/after must be placed within the describe block, otherwise they will apply to tests in other files
  let stub: { restore: () => void }
  before(() => (stub = stubVersions('99.9.9', { spawn: true })))
  after(() => stub.restore())

  it('print rcConfigPath when there is a non-empty rc config file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const tempConfigFile = path.join(tempDir, '.ncurc.json')
    await fs.writeFile(tempConfigFile, JSON.stringify({ filter: 'ncu-test-v2' }), 'utf-8')
    try {
      const { stdout } = await spawn('node', [bin, '--stdin', '--configFilePath', tempDir], {
        stdin: JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0', 'ncu-test-tag': '0.1.0' } }),
      })
      stdout.should.containIgnoreCase(`Using config file ${tempConfigFile}`)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('do not print rcConfigPath when there is no rc config file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    try {
      const { stdout } = await spawn('node', [bin, '--stdin', '--cwd', tempDir], {
        stdin: JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0' } }),
      })
      stdout.should.not.include('Using config file')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('do not print rcConfigPath when there is an empty rc config file', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const tempConfigFile = path.join(tempDir, '.ncurc.json')
    await fs.writeFile(tempConfigFile, '{}', 'utf-8')
    try {
      const { stdout } = await spawn('node', [bin, '--stdin', '--configFilePath', tempDir], {
        stdin: JSON.stringify({ dependencies: { 'ncu-test-v2': '1', 'ncu-test-tag': '0.1.0' } }),
      })
      stdout.should.not.include('Using config file')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('error on missing --configFileName', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const configFileName = '.ncurc_missing.json'
    try {
      const result = spawn('node', [bin, '--stdin', '--configFilePath', tempDir, '--configFileName', configFileName], {
        stdin: JSON.stringify({ dependencies: { 'ncu-test-v2': '1', 'ncu-test-tag': '0.1.0' } }),
      })
      await result.should.eventually.be.rejectedWith(`Config file ${configFileName} not found in ${tempDir}`)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('read --configFilePath', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const tempConfigFile = path.join(tempDir, '.ncurc.json')
    await fs.writeFile(tempConfigFile, JSON.stringify({ jsonUpgraded: true, filter: 'ncu-test-v2' }), 'utf-8')
    try {
      const { stdout } = await spawn('node', [bin, '--stdin', '--configFilePath', tempDir], {
        stdin: JSON.stringify({ dependencies: { 'ncu-test-v2': '1', 'ncu-test-tag': '0.1.0' } }),
      })
      const pkgData = JSON.parse(stdout)
      pkgData.should.have.property('ncu-test-v2')
      pkgData.should.not.have.property('ncu-test-tag')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('read --configFileName', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const tempConfigFileName = '.rctemp.json'
    const tempConfigFile = path.join(tempDir, tempConfigFileName)
    await fs.writeFile(tempConfigFile, JSON.stringify({ jsonUpgraded: true, filter: 'ncu-test-v2' }), 'utf-8')
    try {
      const { stdout } = await spawn(
        'node',
        [bin, '--stdin', '--configFilePath', tempDir, '--configFileName', tempConfigFileName],
        { stdin: JSON.stringify({ dependencies: { 'ncu-test-v2': '1', 'ncu-test-tag': '0.1.0' } }) },
      )
      const pkgData = JSON.parse(stdout)
      pkgData.should.have.property('ncu-test-v2')
      pkgData.should.not.have.property('ncu-test-tag')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('override config with arguments', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const tempConfigFile = path.join(tempDir, '.ncurc.json')
    await fs.writeFile(tempConfigFile, JSON.stringify({ jsonUpgraded: true, filter: 'ncu-test-v2' }), 'utf-8')
    try {
      const { stdout } = await spawn(
        'node',
        [bin, '--stdin', '--configFilePath', tempDir, '--filter', 'ncu-test-tag'],
        { stdin: JSON.stringify({ dependencies: { 'ncu-test-v2': '1', 'ncu-test-tag': '0.1.0' } }) },
      )
      const pkgData = JSON.parse(stdout)
      pkgData.should.have.property('ncu-test-tag')
      pkgData.should.not.have.property('ncu-test-v2')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('override true in config with false in the cli', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const tempConfigFile = path.join(tempDir, '.ncurc.json')
    await fs.writeFile(tempConfigFile, JSON.stringify({ jsonUpgraded: true }), 'utf-8')
    try {
      const { stdout } = await spawn('node', [bin, '--stdin', '--configFilePath', tempDir, '--no-jsonUpgraded'], {
        stdin: JSON.stringify({ dependencies: { 'ncu-test-v2': '1', 'ncu-test-tag': '0.1.0' } }),
      })
      // if the output contains "Using config file", then we know that jsonUpgraded was overridden
      stdout.should.include('Using config file')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('handle boolean arguments', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const tempConfigFile = path.join(tempDir, '.ncurc.json')
    // if boolean arguments are not handled as a special case, ncu will incorrectly pass "--deep false" to commander, which will interpret it as two args, i.e. --deep and --filter false
    await fs.writeFile(tempConfigFile, JSON.stringify({ jsonUpgraded: true, deep: false }), 'utf-8')
    try {
      const { stdout } = await spawn('node', [bin, '--stdin', '--configFilePath', tempDir], {
        stdin: JSON.stringify({ dependencies: { 'ncu-test-tag': '0.1.0' } }),
      })
      const pkgData = JSON.parse(stdout)
      pkgData.should.have.property('ncu-test-tag')
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('auto detect .ncurc.json', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const configFile = path.join(tempDir, '.ncurc.json')
    const pkgFile = path.join(tempDir, 'package.json')
    await fs.writeFile(configFile, JSON.stringify({ filter: 'ncu-test-v2' }), 'utf-8')
    await fs.writeFile(
      pkgFile,
      JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0', 'ncu-test-tag': '0.1.0' } }),
      'utf-8',
    )
    try {
      // awkwardly, we have to set mergeConfig to enable autodetecting the rcconfig because otherwise it is explicitly disabled for tests
      const { stdout } = await spawn('node', [bin, '--mergeConfig'], {}, { cwd: tempDir })
      const firstLine = stdout.split('\n')[0]
      // On OSX tempDir is /var/folders/cb/12345, but npm-check-updates recieves /private/var/folders/cb/12345.
      // Apparently OSX symlinks /tmp to /private/tmp for historical reasons.
      // Therefore, ignore any directories prepended to the config file path.
      firstLine.should.contains('Using config file')
      firstLine.should.contains(configFile)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('auto detect .ncurc.cjs', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const configFile = path.join(tempDir, '.ncurc.cjs')
    const pkgFile = path.join(tempDir, 'package.json')
    await fs.writeFile(configFile, 'module.exports = { "filter": "ncu-test-v2" }', 'utf-8')
    await fs.writeFile(
      pkgFile,
      JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0', 'ncu-test-tag': '0.1.0' } }),
      'utf-8',
    )
    try {
      // awkwardly, we have to set mergeConfig to enable autodetecting the rcconfig because otherwise it is explicitly disabled for tests
      const { stdout } = await spawn('node', [bin, '--mergeConfig'], {}, { cwd: tempDir })
      const firstLine = stdout.split('\n')[0]
      // On OSX tempDir is /var/folders/cb/12345, but npm-check-updates recieves /private/var/folders/cb/12345.
      // Apparently OSX symlinks /tmp to /private/tmp for historical reasons.
      // Therefore, ignore any directories prepended to the config file path.
      firstLine.should.contains('Using config file')
      firstLine.should.contains(configFile)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('should not crash if because of $schema property', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
    const configFile = path.join(tempDir, '.ncurc.json')
    const pkgFile = path.join(tempDir, 'package.json')
    await fs.writeFile(configFile, JSON.stringify({ $schema: 'schema url' }), 'utf-8')
    await fs.writeFile(pkgFile, JSON.stringify({ dependencies: { axios: '1.0.0' } }), 'utf-8')

    try {
      // awkwardly, we have to set mergeConfig to enable autodetecting the rcconfig because otherwise it is explicitly disabled for tests
      await spawn('node', [bin, '--mergeConfig'], {}, { cwd: tempDir })
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('config functions', () => {
    it('filter function', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
      const configFile = path.join(tempDir, '.ncurc.js')
      const pkgFile = path.join(tempDir, 'package.json')
      await fs.writeFile(
        configFile,
        `module.exports = {
        filter: name => name.endsWith('tag')
       }`,
        'utf-8',
      )
      await fs.writeFile(
        pkgFile,
        JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0', 'ncu-test-tag': '0.1.0' } }),
        'utf-8',
      )
      try {
        // awkwardly, we have to set mergeConfig to enable autodetecting the rcconfig because otherwise it is explicitly disabled for tests
        const { stdout } = await spawn('node', [bin, '--mergeConfig', '--jsonUpgraded'], {}, { cwd: tempDir })
        const pkgData = JSON.parse(stdout)
        pkgData.should.not.have.property('ncu-test-v2')
        pkgData.should.have.property('ncu-test-tag')
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    })

    it('filterVersion function', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
      const configFile = path.join(tempDir, '.ncurc.js')
      const pkgFile = path.join(tempDir, 'package.json')
      await fs.writeFile(
        configFile,
        `module.exports = {
        filterVersion: version => version === '1.0.0'
       }`,
        'utf-8',
      )
      await fs.writeFile(
        pkgFile,
        JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0', 'ncu-test-tag': '0.1.0' } }),
        'utf-8',
      )
      try {
        // awkwardly, we have to set mergeConfig to enable autodetecting the rcconfig because otherwise it is explicitly disabled for tests
        const { stdout } = await spawn('node', [bin, '--mergeConfig', '--jsonUpgraded'], {}, { cwd: tempDir })
        const pkgData = JSON.parse(stdout)
        pkgData.should.have.property('ncu-test-v2')
        pkgData.should.not.have.property('ncu-test-tag')
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    })

    it('filterResults function', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
      const configFile = path.join(tempDir, '.ncurc.js')
      const pkgFile = path.join(tempDir, 'package.json')
      await fs.writeFile(
        configFile,
        `module.exports = {
        filterResults: (name, { upgradedVersion }) => upgradedVersion === '99.9.9'
       }`,
        'utf-8',
      )
      await fs.writeFile(
        pkgFile,
        JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0', 'ncu-test-tag': '0.1.0' } }),
        'utf-8',
      )
      try {
        // awkwardly, we have to set mergeConfig to enable autodetecting the rcconfig because otherwise it is explicitly disabled for tests
        const { stdout } = await spawn('node', [bin, '--mergeConfig', '--jsonUpgraded'], {}, { cwd: tempDir })
        const pkgData = JSON.parse(stdout)
        pkgData.should.have.property('ncu-test-v2')
        pkgData.should.have.property('ncu-test-tag')
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    })

    it('reject function', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
      const configFile = path.join(tempDir, '.ncurc.js')
      const pkgFile = path.join(tempDir, 'package.json')
      await fs.writeFile(
        configFile,
        `module.exports = {
        reject: name => name.endsWith('tag')
       }`,
        'utf-8',
      )
      await fs.writeFile(
        pkgFile,
        JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0', 'ncu-test-tag': '0.1.0' } }),
        'utf-8',
      )
      try {
        // awkwardly, we have to set mergeConfig to enable autodetecting the rcconfig because otherwise it is explicitly disabled for tests
        const { stdout } = await spawn('node', [bin, '--mergeConfig', '--jsonUpgraded'], {}, { cwd: tempDir })
        const pkgData = JSON.parse(stdout)
        pkgData.should.have.property('ncu-test-v2')
        pkgData.should.not.have.property('ncu-test-tag')
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    })

    it('rejectVersion function', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'npm-check-updates-'))
      const configFile = path.join(tempDir, '.ncurc.js')
      const pkgFile = path.join(tempDir, 'package.json')
      await fs.writeFile(
        configFile,
        `module.exports = {
        rejectVersion: version => version === '1.0.0'
       }`,
        'utf-8',
      )
      await fs.writeFile(
        pkgFile,
        JSON.stringify({ dependencies: { 'ncu-test-v2': '1.0.0', 'ncu-test-tag': '0.1.0' } }),
        'utf-8',
      )
      try {
        // awkwardly, we have to set mergeConfig to enable autodetecting the rcconfig because otherwise it is explicitly disabled for tests
        const { stdout } = await spawn('node', [bin, '--mergeConfig', '--jsonUpgraded'], {}, { cwd: tempDir })
        const pkgData = JSON.parse(stdout)
        pkgData.should.not.have.property('ncu-test-v2')
        pkgData.should.have.property('ncu-test-tag')
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true })
      }
    })
  })
})

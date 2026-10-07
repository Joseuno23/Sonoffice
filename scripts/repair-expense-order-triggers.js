#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const DRY_RUN = process.argv.includes('--dry-run');

const TARGET_TABLES = ['ord_gastos', 'det_ordgasto'];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).reduce((env, line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return env;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return env;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
    return env;
  }, {});
}

function maskPassword(password) {
  if (!password) {
    return '<empty>';
  }

  return `${'*'.repeat(Math.min(password.length, 8))} (${password.length} chars)`;
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function parseDefiner(definer) {
  const separatorIndex = String(definer || '').lastIndexOf('@');

  if (separatorIndex <= 0 || separatorIndex === definer.length - 1) {
    throw new Error(`Formato de DEFINER inválido para ${definer || '<empty>'}`);
  }

  return {
    user: definer.slice(0, separatorIndex),
    host: definer.slice(separatorIndex + 1),
  };
}

function buildCreateTriggerSql(trigger) {
  return [
    'CREATE TRIGGER',
    quoteIdentifier(trigger.TRIGGER_NAME),
    trigger.ACTION_TIMING,
    trigger.EVENT_MANIPULATION,
    'ON',
    quoteIdentifier(trigger.EVENT_OBJECT_TABLE),
    'FOR EACH ROW',
    trigger.ACTION_STATEMENT,
  ].join(' ');
}

async function restoreSessionSettings(connection, settings) {
  await connection.query('SET SESSION sql_mode = ?', [settings.sqlMode]);
  await connection.query('SET character_set_client = ?', [settings.characterSetClient]);
  await connection.query('SET collation_connection = ?', [settings.collationConnection]);
}

async function getSessionSettings(connection) {
  const [[settings]] = await connection.query(
    'SELECT @@SESSION.sql_mode AS sqlMode, @@character_set_client AS characterSetClient, @@collation_connection AS collationConnection'
  );

  return settings;
}

async function definerExists(connection, definer) {
  const { user, host } = parseDefiner(definer);
  const [rows] = await connection.query(
    'SELECT 1 AS exists_flag FROM mysql.user WHERE User = ? AND Host = ? LIMIT 1',
    [user, host]
  );

  return rows.length > 0;
}

async function repairTrigger(connection, trigger, originalSettings) {
  const dropSql = `DROP TRIGGER ${quoteIdentifier(trigger.TRIGGER_SCHEMA)}.${quoteIdentifier(trigger.TRIGGER_NAME)}`;
  const createSql = buildCreateTriggerSql(trigger);

  await connection.query('SET SESSION sql_mode = ?', [trigger.SQL_MODE || '']);
  await connection.query('SET character_set_client = ?', [trigger.CHARACTER_SET_CLIENT || originalSettings.characterSetClient]);
  await connection.query('SET collation_connection = ?', [trigger.COLLATION_CONNECTION || originalSettings.collationConnection]);

  try {
    await connection.query(dropSql);
    await connection.query(createSql);
  } finally {
    await restoreSessionSettings(connection, originalSettings);
  }
}

async function main() {
  const fileEnv = parseEnvFile(ENV_PATH);
  const env = { ...fileEnv, ...process.env };
  const config = {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD || '',
  };

  console.log('==> Target database');
  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log(`Database: ${config.database || '<missing>'}`);
  console.log(`User: ${config.user || '<missing>'}`);
  console.log(`Password: ${maskPassword(config.password)}`);
  console.log('');

  if (!config.database || !config.user) {
    throw new Error('DB_NAME y DB_USER son obligatorios. Revisá .env antes de ejecutar.');
  }

  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    ...config,
    multipleStatements: false,
  });

  try {
    const [triggers] = await connection.query(
      `SELECT
         TRIGGER_SCHEMA,
         TRIGGER_NAME,
         EVENT_MANIPULATION,
         EVENT_OBJECT_TABLE,
         ACTION_STATEMENT,
         ACTION_TIMING,
         SQL_MODE,
         DEFINER,
         CHARACTER_SET_CLIENT,
         COLLATION_CONNECTION
       FROM information_schema.TRIGGERS
       WHERE TRIGGER_SCHEMA = ?
         AND EVENT_OBJECT_TABLE IN (?, ?)
       ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME`,
      [config.database, ...TARGET_TABLES]
    );

    if (triggers.length === 0) {
      console.log('==> No se encontraron triggers de Órdenes de gastos. No hay cambios.');
      return;
    }

    const originalSettings = await getSessionSettings(connection);
    let repairedCount = 0;

    console.log('==> Triggers revisados');

    for (const trigger of triggers) {
      const exists = await definerExists(connection, trigger.DEFINER);

      if (exists) {
        console.log(`- ${trigger.EVENT_OBJECT_TABLE}.${trigger.TRIGGER_NAME}: definer ${trigger.DEFINER} existe. Sin cambios.`);
        continue;
      }

      console.log(`- ${trigger.EVENT_OBJECT_TABLE}.${trigger.TRIGGER_NAME}: definer ${trigger.DEFINER} no existe.`);

      if (DRY_RUN) {
        console.log('  Dry run: se recrearía sin DEFINER explícito usando el usuario conectado.');
        continue;
      }

      await repairTrigger(connection, trigger, originalSettings);
      repairedCount += 1;
      console.log('  Reparado: trigger recreado sin DEFINER explícito.');
    }

    console.log('');

    if (DRY_RUN) {
      console.log('==> Dry run: no se ejecutó DROP TRIGGER ni CREATE TRIGGER.');
    } else {
      console.log(`==> Reparación finalizada. Triggers reparados: ${repairedCount}.`);
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});

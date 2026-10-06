#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const DRY_RUN = process.argv.includes('--dry-run');

const SQL_FILES = [
  'database/sql/012_seed_media_budgets_menu.sql',
  'database/sql/013_seed_external_production_budget_actions.sql',
  'database/sql/014_seed_internal_production_budget_actions.sql',
];

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

function readSqlFiles() {
  return SQL_FILES.map((relativePath) => {
    const absolutePath = path.join(ROOT_DIR, relativePath);

    if (!absolutePath.startsWith(ROOT_DIR + path.sep)) {
      throw new Error(`Ruta SQL fuera del proyecto: ${relativePath}`);
    }

    return {
      relativePath,
      sql: fs.readFileSync(absolutePath, 'utf8'),
    };
  });
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
  const sqlFiles = readSqlFiles();

  console.log('==> Target database');
  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log(`Database: ${config.database || '<missing>'}`);
  console.log(`User: ${config.user || '<missing>'}`);
  console.log(`Password: ${maskPassword(config.password)}`);
  console.log('');

  console.log('==> SQL files to execute');
  for (const file of sqlFiles) {
    console.log(`- ${file.relativePath}`);
  }
  console.log('');

  if (!config.database || !config.user) {
    throw new Error('DB_NAME y DB_USER son obligatorios. Revisá .env antes de ejecutar.');
  }

  if (DRY_RUN) {
    console.log('==> Dry run: no se abrió conexión y no se ejecutó SQL.');
    return;
  }

  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    ...config,
    multipleStatements: true,
  });

  try {
    await connection.beginTransaction();

    for (const file of sqlFiles) {
      console.log(`==> Ejecutando ${file.relativePath}`);
      await connection.query(file.sql);
    }

    await connection.commit();
    console.log('==> Seeds aplicados correctamente.');

    const [menuRows] = await connection.query(
      "SELECT code, COUNT(*) AS count FROM app_menus WHERE code LIKE 'media.budgets%' GROUP BY code ORDER BY code"
    );
    const [actionRows] = await connection.query(
      "SELECT module_code, COUNT(*) AS count FROM app_actions WHERE module_code IN ('external-production-budgets', 'internal-production-budgets') GROUP BY module_code ORDER BY module_code"
    );

    console.log('');
    console.log('==> Conteo app_menus budget codes');
    for (const row of menuRows) {
      console.log(`${row.code}: ${row.count}`);
    }

    console.log('');
    console.log('==> Conteo app_actions budget modules');
    for (const row of actionRows) {
      console.log(`${row.module_code}: ${row.count}`);
    }
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(`ERROR rollback falló: ${rollbackError.message}`);
    }

    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});

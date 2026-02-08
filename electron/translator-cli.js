const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const CONFIG_FILENAME = 'typecal.config.json';
const DEFAULT_TRANSLATOR_CLI_COMMAND = 'codex';
const DEFAULT_TRANSLATOR_MODEL = '';
const TRANSLATION_TIMEOUT_MS = 120000;

function getConfigPath(app) {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function readConfig(app) {
  try {
    const configPath = getConfigPath(app);
    if (!fs.existsSync(configPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.error('Failed to read config', error);
    return {};
  }
}

function writeConfig(app, partial) {
  const current = readConfig(app);
  const next = { ...current, ...partial };
  fs.writeFileSync(getConfigPath(app), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function buildTranslationPrompt(text, sourceLanguage, targetLanguage) {
  const sourceInstruction =
    sourceLanguage.toLowerCase() === 'auto'
      ? `Detect source language automatically and translate to ${targetLanguage}.`
      : `Translate from ${sourceLanguage} to ${targetLanguage}.`;
  return [
    'You are a strict translation engine.',
    sourceInstruction,
    'Rules:',
    '- Return only the translated text.',
    '- Keep names, numbers, and formatting as-is unless translation is required.',
    '- Do not add explanations, notes, or markdown.',
    '',
    'Text:',
    text,
  ].join('\n');
}

function runCliTranslation(command, model, prompt) {
  const outputPath = path.join(os.tmpdir(), `typecal-translation-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'typecal-translator-'));
  const args = [
    'exec',
    '--cd',
    isolatedCwd,
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--output-last-message',
    outputPath,
  ];

  if (model) {
    args.push('-m', model);
  }
  args.push(prompt);

  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: TRANSLATION_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024, cwd: isolatedCwd }, (error, stdout, stderr) => {
      let translated = '';
      try {
        if (fs.existsSync(outputPath)) {
          translated = fs.readFileSync(outputPath, 'utf-8').trim();
          fs.unlinkSync(outputPath);
        }
      } catch (fileError) {
        console.error('Failed reading translator CLI output', fileError);
      } finally {
        try {
          fs.rmSync(isolatedCwd, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Failed to cleanup translator temp directory', cleanupError);
        }
      }

      if (error) {
        const message = stderr?.trim() || stdout?.trim() || error.message;
        reject(new Error(`Translator CLI failed: ${message}`));
        return;
      }

      if (!translated) {
        const fallback = (stdout || '').trim();
        translated = fallback;
      }

      if (!translated) {
        reject(new Error('Translator CLI returned empty output'));
        return;
      }

      resolve(translated);
    });
  });
}

async function translateWithCli(app, payload) {
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  const sourceLanguage = typeof payload?.sourceLanguage === 'string' ? payload.sourceLanguage.trim() : '';
  const targetLanguage = typeof payload?.targetLanguage === 'string' ? payload.targetLanguage.trim() : '';

  if (!text) {
    throw new Error('Text is required for translation');
  }
  if (!sourceLanguage || !targetLanguage) {
    throw new Error('Both source and target language are required');
  }

  const config = readConfig(app);
  const cliCommand = process.env.TYPECAL_TRANSLATOR_CLI || config.translatorCliCommand || DEFAULT_TRANSLATOR_CLI_COMMAND;
  const model = config.translatorModel || DEFAULT_TRANSLATOR_MODEL;
  const prompt = buildTranslationPrompt(text, sourceLanguage, targetLanguage);
  const translated = await runCliTranslation(cliCommand, model, prompt);

  return { translatedText: translated };
}

function registerTranslatorCliIpc(app, ipcMain) {
  ipcMain.handle('translator:getConfig', () => {
    const config = readConfig(app);
    return {
      translatorCliCommand: config.translatorCliCommand || DEFAULT_TRANSLATOR_CLI_COMMAND,
      translatorModel: config.translatorModel || DEFAULT_TRANSLATOR_MODEL,
    };
  });

  ipcMain.handle('translator:setConfig', (event, partial) => {
    const next = writeConfig(app, {
      translatorCliCommand:
        typeof partial?.translatorCliCommand === 'string' ? partial.translatorCliCommand.trim() : undefined,
      translatorModel: typeof partial?.translatorModel === 'string' ? partial.translatorModel.trim() : undefined,
    });
    return {
      translatorCliCommand: next.translatorCliCommand || DEFAULT_TRANSLATOR_CLI_COMMAND,
      translatorModel: next.translatorModel || DEFAULT_TRANSLATOR_MODEL,
    };
  });

  ipcMain.handle('translator:translate', async (event, payload) => translateWithCli(app, payload));
}

module.exports = {
  registerTranslatorCliIpc,
};

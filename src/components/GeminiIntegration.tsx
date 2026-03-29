import React, { useState } from 'react';
import { VideoEdit, VideoAdjustments } from '../types';
import { Copy, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  onImport: (edits: VideoEdit[], adjustments?: VideoAdjustments) => void;
  onSkip: () => void;
}

export default function GeminiIntegration({ onImport, onSkip }: Props) {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const promptText = `Analise este vídeo e identifique os trechos que seriam "sem graça" ou "pouco atrativos" se fossem usados como thumbnail (miniatura) do YouTube.
Para cada trecho identificado, sugira elementos (textos curtos e chamativos, emojis, ou descrições de imagens) que eu possa adicionar para tornar esse frame mais clicável e interessante.

Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "edits": [
    {
      "id": "1",
      "type": "text",
      "content": "NÃO ACREDITO!",
      "startTime": 10.5,
      "endTime": 15.2,
      "x": 50,
      "y": 50,
      "style": { "fontSize": 48, "color": "#ffffff", "fontFamily": "Impact", "borderColor": "#000000", "borderWidth": 2 }
    },
    {
      "id": "2",
      "type": "image",
      "description": "gato assustado",
      "startTime": 20.0,
      "endTime": 25.0,
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 200
    }
  ],
  "videoAdjustments": {
    "brightness": 100,
    "contrast": 100,
    "saturation": 100
  }
}

Certifique-se de que os tempos (startTime e endTime) estão em segundos. Não inclua Markdown em volta do JSON.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.edits || !Array.isArray(parsed.edits)) {
        throw new Error('O JSON deve conter um array "edits".');
      }
      onImport(parsed.edits, parsed.videoAdjustments);
    } catch (err: any) {
      setError(err.message || 'JSON inválido. Verifique a formatação.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="bg-[#212121] rounded-xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <i className="fa-solid fa-wand-magic-sparkles text-[#ff0000]"></i>
          Análise com Gemini
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Passo 1 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-300">1. Copie o Prompt</h3>
            <p className="text-sm text-gray-400">
              Copie o texto abaixo e cole no Google Gemini junto com o upload do seu vídeo.
            </p>
            <div className="relative">
              <textarea
                readOnly
                value={promptText}
                className="w-full h-48 bg-[#0f0f0f] border border-[#3d3d3d] rounded-lg p-4 text-sm font-mono text-gray-300 resize-none focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 bg-[#3d3d3d] hover:bg-[#4d4d4d] p-2 rounded-md transition-colors"
                title="Copiar Prompt"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <a
              href="https://gemini.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2 rounded-md font-medium transition-colors w-full justify-center"
            >
              Abrir Google Gemini <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Passo 2 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-300">2. Cole o Resultado (JSON)</h3>
            <p className="text-sm text-gray-400">
              Após o Gemini analisar o vídeo, copie o código JSON gerado e cole aqui.
            </p>
            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setError('');
              }}
              placeholder='{"edits": [...]}'
              className="w-full h-48 bg-[#0f0f0f] border border-[#3d3d3d] rounded-lg p-4 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-[#ff0000]"
            />
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div className="flex gap-4">
              <button
                onClick={handleImport}
                disabled={!jsonInput.trim()}
                className="flex-1 bg-[#ff0000] hover:bg-[#cc0000] disabled:bg-[#3d3d3d] disabled:text-gray-500 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                Importar Edições
              </button>
              <button
                onClick={onSkip}
                className="px-4 py-2 border border-[#3d3d3d] hover:bg-[#3d3d3d] rounded-md font-medium transition-colors"
              >
                Pular
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

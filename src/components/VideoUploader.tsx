import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

interface Props {
  onUpload: (file: File) => void;
}

export default function VideoUploader({ onUpload }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      onUpload(file);
    } else {
      alert('Por favor, envie um arquivo de vídeo válido.');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-4">Melhore seus vídeos para o YouTube</h2>
        <p className="text-gray-400">
          Faça o upload do seu vídeo para começar. Nós ajudaremos você a adicionar elementos atrativos nos momentos mais "sem graça" para garantir que qualquer thumbnail automática seja clicável.
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-[#ff0000] bg-[#ff0000]/10' : 'border-[#3d3d3d] bg-[#212121] hover:border-gray-500'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="bg-[#3d3d3d] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-medium mb-2">Arraste e solte o vídeo aqui</h3>
        <p className="text-gray-400 mb-6">ou clique para selecionar do seu computador</p>
        <button className="bg-[#ff0000] hover:bg-[#cc0000] text-white px-6 py-2 rounded-md font-medium transition-colors">
          Selecionar Arquivo
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="video/mp4,video/webm,video/ogg"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
        />
      </div>
    </div>
  );
}

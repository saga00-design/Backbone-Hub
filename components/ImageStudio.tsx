import React, { useState, useRef } from 'react';
import { Button } from './Button';
import { Upload, Wand2, Download, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { editInventoryImage } from '../services/geminiService';
import { toast } from 'sonner';

export const ImageStudio: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMimeType(file.type);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          setOriginalImage(e.target.result);
          setGeneratedImage(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!originalImage || !prompt) return;

    setIsLoading(true);
    try {
      // Remove data URL prefix for API call
      const base64Data = originalImage.split(',')[1];
      const result = await editInventoryImage(base64Data, mimeType, prompt);
      setGeneratedImage(result);
    } catch (error) {
      toast.error("Failed to edit image. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `edited-inventory-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6 border-b pb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Wand2 className="mr-2 h-6 w-6 text-purple-600" />
          AI Studio (Nano Banana)
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload an inventory photo and use text prompts to edit it (e.g., "Remove background", "Add a vintage filter", "Place on a wooden table").
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-4">
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg h-64 flex items-center justify-center bg-gray-50 hover:border-brand-500 transition-colors cursor-pointer overflow-hidden relative"
            onClick={() => fileInputRef.current?.click()}
          >
            {originalImage ? (
              <img src={originalImage} alt="Original" className="h-full w-full object-contain" />
            ) : (
              <div className="text-center p-6">
                <ImageIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Click to upload image</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Editing Prompt</label>
            <textarea
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 p-2 border"
              rows={3}
              placeholder="Describe how you want to change the image..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={!originalImage || !prompt || isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Generate Edit
          </Button>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          <div className="border-2 border-gray-200 rounded-lg h-64 flex items-center justify-center bg-gray-100 overflow-hidden relative">
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-2"></div>
                <p className="text-sm text-purple-600">Processing with Gemini 2.5...</p>
              </div>
            ) : generatedImage ? (
              <img src={generatedImage} alt="Generated" className="h-full w-full object-contain" />
            ) : (
              <p className="text-gray-400 text-sm">Edited image will appear here</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={downloadImage} 
              disabled={!generatedImage} 
              variant="secondary"
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button 
              onClick={() => { setGeneratedImage(null); }} 
              disabled={!generatedImage}
              variant="ghost"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

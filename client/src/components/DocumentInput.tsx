import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { X, Upload, Bot, FileText, Mic, Trash2, CheckSquare, Square, Plus, Files } from "lucide-react";
import { extractTextFromFile } from "@/lib/analysis";
import { DocumentInput as DocumentInputType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import SimpleSpeechInput from "@/components/SimpleSpeechInput";
import { MathRenderer } from "@/components/MathRenderer";

interface UploadedDocument {
  id: string;
  filename: string;
  content: string;
  wordCount: number;
}

interface DocumentInputProps {
  id: "A" | "B";
  document: DocumentInputType;
  setDocument: (document: DocumentInputType) => void;
  onCheckAI: () => void;
}

const DocumentInput: React.FC<DocumentInputProps> = ({
  id,
  document,
  setDocument,
  onCheckAI,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showMathView, setShowMathView] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Calculate word and character count
  useEffect(() => {
    if (document.content) {
      const words = document.content.trim().split(/\s+/).filter(Boolean);
      setWordCount(words.length);
      setCharCount(document.content.length);
    } else {
      setWordCount(0);
      setCharCount(0);
    }
  }, [document.content]);

  // Combine uploaded documents into the main content
  const combineDocuments = (docs: UploadedDocument[]) => {
    if (docs.length === 0) return "";
    if (docs.length === 1) return docs[0].content;
    
    return docs.map((doc, index) => 
      `=== DOCUMENT ${index + 1}: ${doc.filename} ===\n\n${doc.content}`
    ).join('\n\n---\n\n');
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDocument({ ...document, content: e.target.value });
    if (uploadedDocuments.length > 0) {
      setUploadedDocuments([]);
    }
  };

  const handleContextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocument({ ...document, context: e.target.value });
  };

  const handleClearText = () => {
    setDocument({ content: "", context: "" });
    setUploadedDocuments([]);
  };

  const handleMultipleFileUpload = async (files: File[]) => {
    try {
      setIsLoading(true);
      const newDocs: UploadedDocument[] = [];
      
      for (const file of files) {
        const result = await extractTextFromFile(file);
        const words = result.content.trim().split(/\s+/).filter(Boolean);
        newDocs.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename: file.name,
          content: result.content,
          wordCount: words.length,
        });
      }
      
      const allDocs = [...uploadedDocuments, ...newDocs];
      setUploadedDocuments(allDocs);
      
      const combinedContent = combineDocuments(allDocs);
      setDocument({ 
        ...document, 
        content: combinedContent,
        filename: allDocs.length > 1 ? `${allDocs.length} documents combined` : allDocs[0]?.filename
      });
    } catch (error) {
      console.error("Error extracting text from files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    await handleMultipleFileUpload([file]);
  };

  const handleRemoveDocument = (docId: string) => {
    const newDocs = uploadedDocuments.filter(d => d.id !== docId);
    setUploadedDocuments(newDocs);
    
    if (newDocs.length === 0) {
      setDocument({ content: "", context: document.context });
    } else {
      const combinedContent = combineDocuments(newDocs);
      setDocument({ 
        ...document, 
        content: combinedContent,
        filename: newDocs.length > 1 ? `${newDocs.length} documents combined` : newDocs[0]?.filename
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleMultipleFileUpload(Array.from(files));
    }
  };

  const [dictationActive, setDictationActive] = useState(false);
  
  const handleDictatedText = (text: string) => {
    setDocument({
      ...document,
      content: text
    });
    if (uploadedDocuments.length > 0) {
      setUploadedDocuments([]);
    }
  };

  const handleChunkToggle = (chunkId: string, selected: boolean) => {
    const selectedChunkIds = document.selectedChunkIds || [];
    
    if (selected) {
      setDocument({
        ...document,
        selectedChunkIds: [...selectedChunkIds, chunkId]
      });
    } else {
      setDocument({
        ...document,
        selectedChunkIds: selectedChunkIds.filter(id => id !== chunkId)
      });
    }
  };

  const handleSelectAllChunks = () => {
    if (!document.chunks) return;
    
    setDocument({
      ...document,
      selectedChunkIds: document.chunks.map(chunk => chunk.id)
    });
  };

  const handleDeselectAllChunks = () => {
    setDocument({
      ...document,
      selectedChunkIds: []
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Document {id}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearText}
            className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 flex items-center"
            title="Clear text"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCheckAI}
            className="px-3 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 flex items-center"
          >
            <Bot className="h-4 w-4 mr-1" /> Check for AI
          </Button>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 mb-4 ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center py-6">
          <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-1">Drag and drop your documents here</p>
          <p className="text-blue-600 font-medium mb-2">
            <Files className="h-4 w-4 inline mr-1" />
            Multiple files supported - combine documents for unified analysis
          </p>
          <p className="text-gray-500 text-sm mb-4">Supports .docx, .pdf, .txt files and images (.jpg, .png, .gif, .bmp, .webp)</p>
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700"
              data-testid="button-upload-document"
            >
              <Plus className="h-4 w-4 mr-1" />
              Upload Document{uploadedDocuments.length > 0 ? 's' : ''}
            </Button>
            <FileInput
              ref={fileInputRef}
              id={`fileInput${id}`}
              accept=".docx,.pdf,.txt,.jpg,.jpeg,.png,.gif,.bmp,.webp"
              multiple
              onFilesSelected={handleMultipleFileUpload}
            />
          </div>
        </div>
      </div>

      {uploadedDocuments.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-green-800 flex items-center">
              <Files className="h-4 w-4 mr-1" />
              {uploadedDocuments.length} Document{uploadedDocuments.length > 1 ? 's' : ''} Loaded
            </h3>
            <Badge variant="secondary" className="text-xs">
              {uploadedDocuments.reduce((sum, d) => sum + d.wordCount, 0).toLocaleString()} total words
            </Badge>
          </div>
          <div className="space-y-2">
            {uploadedDocuments.map((doc, index) => (
              <div 
                key={doc.id} 
                className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-green-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                    {index + 1}
                  </span>
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700 truncate max-w-[200px]" title={doc.filename}>
                    {doc.filename}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {doc.wordCount.toLocaleString()} words
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDocument(doc.id)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  data-testid={`button-remove-doc-${doc.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          {uploadedDocuments.length > 1 && (
            <p className="text-xs text-green-700 mt-2">
              Documents will be combined for analysis. Use instructions like "COMBINE THESE INTO A SINGLE WORK ON [TOPIC]"
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          <div className="mb-2 border-b border-gray-200 pb-2 flex justify-between items-center">
            <SimpleSpeechInput 
              onTextCaptured={handleDictatedText} 
              buttonLabel="Dictate Text" 
              className="mb-1"
            />
            {document.content && (document.content.includes('\\') || document.content.includes('^') || document.content.includes('_') || document.content.includes('$')) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMathView(!showMathView)}
                className="text-xs"
              >
                {showMathView ? "Normal View" : "View Math"}
              </Button>
            )}
          </div>

          {showMathView && document.content ? (
            <div className="w-full h-40 p-4 border border-gray-300 rounded-lg bg-gray-50 overflow-y-auto overflow-x-auto">
              <div style={{ minHeight: '100%', overflow: 'visible' }}>
                <MathRenderer content={document.content} className="text-gray-800" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                id={`textInput${id}`}
                placeholder="Type, paste, or dictate your text here... Or upload multiple documents to combine them."
                className="w-full h-40 p-4 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                value={document.content}
                onChange={handleTextChange}
              />
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <label htmlFor={`contextInput${id}`} className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Instructions (Optional)
                </label>
                <input
                  id={`contextInput${id}`}
                  type="text"
                  placeholder='e.g., "COMBINE THESE INTO A SINGLE WORK ON SYSTEMS SCIENCE" or "This is an abstract"'
                  className="w-full px-3 py-2 border border-yellow-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={document.context || ''}
                  onChange={handleContextChange}
                />
                <p className="text-xs text-gray-600 mt-1">
                  {uploadedDocuments.length > 1 
                    ? "Tell the AI how to combine or process your multiple documents"
                    : "Help the analysis understand what type of text this is for better assessment"}
                </p>
              </div>
            </div>
          )}

          {document.chunks && document.chunks.length > 1 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-blue-800">
                  Large Document Detected ({document.originalWordCount} words)
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllChunks}
                    className="text-xs px-2 py-1"
                    data-testid="button-select-all-chunks"
                  >
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllChunks}
                    className="text-xs px-2 py-1"
                    data-testid="button-deselect-all-chunks"
                  >
                    <Square className="h-3 w-3 mr-1" />
                    Deselect All
                  </Button>
                </div>
              </div>
              
              <p className="text-xs text-blue-700 mb-3">
                Select which sections to analyze (each chunk is ~1000 words):
              </p>
              
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                {document.chunks.map((chunk, index) => {
                  const isSelected = document.selectedChunkIds?.includes(chunk.id) || false;
                  
                  return (
                    <Card key={chunk.id} className={`p-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}>
                      <div 
                        className="flex items-start gap-3"
                        onClick={() => handleChunkToggle(chunk.id, !isSelected)}
                        data-testid={`chunk-selector-${chunk.id}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => handleChunkToggle(chunk.id, (e.target as HTMLInputElement).checked)}
                          className="mt-0.5"
                          data-testid={`checkbox-${chunk.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <h4 className="text-xs font-semibold text-gray-700">
                              Chunk {index + 1}
                            </h4>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {chunk.wordCount} words
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {chunk.preview}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              
              <div className="mt-3 text-xs text-blue-700">
                {document.selectedChunkIds?.length || 0} of {document.chunks.length} chunks selected
              </div>
            </div>
          )}
          
          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <div className="flex items-center">
              <FileText className="h-3 w-3 mr-1" />
              <span>
                <Badge variant="secondary" className="text-xs font-normal px-2 py-0">
                  {wordCount} words
                </Badge>
              </span>
              
              {document.filename?.toLowerCase().endsWith('.pdf') && document.metadata?.pageCount && (
                <Badge variant="secondary" className="text-xs font-normal px-2 py-0 ml-2">
                  {document.metadata.pageCount} pages
                </Badge>
              )}
              
              {document.filename && (
                <Badge variant="secondary" className="text-xs font-normal px-2 py-0 ml-2">
                  {document.filename}
                </Badge>
              )}
            </div>
            <div>
              <Badge variant="outline" className="text-xs font-normal px-2 py-0">
                {charCount} characters
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentInput;

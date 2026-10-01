'use client';

import React, { useEffect, useState } from 'react';

interface BlockEditorClientProps {
  blocks: import('@/types/blockEditor').EditorBlock[];
  onBlocksChange: (blocks: import('@/types/blockEditor').EditorBlock[]) => void;
  onAIRewrite?: (text: string, instruction: string) => Promise<string>;
}

export default function BlockEditorClient({ 
  blocks, 
  onBlocksChange, 
  onAIRewrite 
}: BlockEditorClientProps) {
  const [BlockEditor, setBlockEditor] = useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const loadBlockEditor = async () => {
      try {
        // Use a string variable to prevent static analysis
        const modulePath = './BlockEditor';
        const mod = await import(modulePath);
        setBlockEditor(() => mod.default);
      } catch (err) {
        setLoadError(err as Error);
      }
    };
    loadBlockEditor();
  }, [isClient]);

  // Os returns antecipados ficam DEPOIS de todos os hooks. Com o de `isClient`
  // antes, o import dinâmico pulava no primeiro render e o editor nunca carregava.
  if (!isClient) {
    return <div className="p-4 text-center text-stone-500">Carregando editor de blocos...</div>;
  }

  if (loadError) {
    return (
      <div className="p-4 text-center text-rose-600">
        Erro ao carregar editor de blocos: {loadError.message}
      </div>
    );
  }

  if (!BlockEditor) {
    return <div className="p-4 text-center text-stone-500">Carregando editor de blocos...</div>;
  }

  return <BlockEditor blocks={blocks} onBlocksChange={onBlocksChange} onAIRewrite={onAIRewrite} />;
}
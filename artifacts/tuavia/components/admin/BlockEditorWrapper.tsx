'use client';

import React, { useEffect, useState } from 'react';
import BlockEditorClient from './BlockEditorClient';
import type { EditorBlock } from '@/types/blockEditor';

interface BlockEditorWrapperProps {
  blocks: EditorBlock[];
  onBlocksChange: (blocks: EditorBlock[]) => void;
  onAIRewrite?: (text: string, instruction: string) => Promise<string>;
}

export default function BlockEditorWrapper({ 
  blocks, 
  onBlocksChange, 
  onAIRewrite 
}: BlockEditorWrapperProps) {
  return <BlockEditorClient blocks={blocks} onBlocksChange={onBlocksChange} onAIRewrite={onAIRewrite} />;
}
import { useCallback, useEffect, useState } from "react";
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isTextNode,
  EditorState,
  TextNode,
  NodeKey,
  LexicalNode,
  COMMAND_PRIORITY_CRITICAL,
  KEY_BACKSPACE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createRangeSelection,
  $setSelection,
  RangeSelection,
  createEditor,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, Users } from "lucide-react";
import type { Group } from "@db/schema";

// Update MentionNode to support both users and groups
export class MentionNode extends TextNode {
  __mention: string;
  __type: 'user' | 'group';

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mention, node.__type, node.__text, node.__key);
  }

  constructor(mentionName: string, type: 'user' | 'group', text?: string, key?: NodeKey) {
    super(text ?? `@${mentionName}`, key);
    this.__mention = mentionName;
    this.__type = type;
  }

  createDOM(config: any): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.color = this.__type === 'group' ? 'hsl(var(--primary))' : 'hsl(var(--primary))';
    dom.style.fontWeight = '500';
    dom.style.whiteSpace = 'nowrap';
    dom.classList.add('mention', `mention-${this.__type}`);
    dom.setAttribute('data-mention', this.__mention);
    dom.setAttribute('data-mention-type', this.__type);
    return dom;
  }

  isSegmented(): boolean {
    return false;
  }

  createSelection(): RangeSelection {
    const selection = $createRangeSelection();
    selection.anchor.set(this.getKey(), 0, 'text');
    selection.focus.set(this.getKey(), this.getTextContent().length, 'text');
    return selection;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      mentionName: this.__mention,
      type: 'mention',
      mentionType: this.__type,
      version: 1,
    };
  }

  static importJSON(serializedNode: any): MentionNode {
    const node = $createMentionNode(
      serializedNode.mentionName,
      serializedNode.mentionType || 'user'
    );
    node.setTextContent(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportDOM(): { element?: HTMLElement } {
    const element = document.createElement('span');
    element.classList.add('mention', `mention-${this.__type}`);
    element.setAttribute('data-mention', this.__mention);
    element.setAttribute('data-mention-type', this.__type);
    element.textContent = this.getTextContent();
    return { element };
  }

  static importDOM(): { span: () => boolean } {
    return {
      span: (domNode: HTMLElement) => {
        return domNode.hasAttribute('data-mention');
      },
    };
  }
}

export function $createMentionNode(mentionName: string, type: 'user' | 'group'): MentionNode {
  return new MentionNode(mentionName, type);
}

export function $isMentionNode(node: LexicalNode | null | undefined): boolean {
  return node instanceof MentionNode;
}

const theme = {
  text: {
    base: "text-foreground",
  },
  mention: "text-primary font-medium",
};

interface MentionSuggestion {
  id: number;
  name: string;
  type: 'user' | 'group';
  avatar?: string | null;
}

function MentionsPlugin({
  users,
  groups
}: {
  users: Array<{ id: number; username: string; avatar: string | null }>;
  groups: Array<{ id: number; name: string }>;
}) {
  const [editor] = useLexicalComposerContext();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const checkForMentionPattern = useCallback((text: string) => {
    const match = text.match(/@(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();

      const userSuggestions: MentionSuggestion[] = users
        .filter(user => user.username.toLowerCase().includes(query))
        .map(user => ({
          id: user.id,
          name: user.username,
          type: 'user' as const,
          avatar: user.avatar
        }));

      const groupSuggestions: MentionSuggestion[] = groups
        .filter(group => group.name.toLowerCase().includes(query))
        .map(group => ({
          id: group.id,
          name: group.name,
          type: 'group' as const
        }));

      const combined = [...groupSuggestions, ...userSuggestions];
      setSuggestions(combined);
      setShowSuggestions(combined.length > 0);
      setSelectedIndex(0);

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const editorElement = editor.getRootElement();
        if (editorElement) {
          const editorRect = editorElement.getBoundingClientRect();
          setMentionPosition({
            top: rect.bottom - editorRect.top,
            left: rect.left - editorRect.left,
          });
        }
      }
    } else {
      setShowSuggestions(false);
    }
  }, [editor, users, groups]);

  useEffect(() => {
    const removeListener = editor.registerTextContentListener((text) => {
      checkForMentionPattern(text);
    });

    return removeListener;
  }, [editor, checkForMentionPattern]);

  const insertMention = useCallback((suggestion: MentionSuggestion) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const nodes = selection.getNodes();
      const lastNode = nodes[nodes.length - 1];
      const textContent = lastNode.getTextContent();
      const mentionOffset = textContent.lastIndexOf('@');

      if (mentionOffset === -1) return;

      const mentionNode = $createMentionNode(suggestion.name, suggestion.type);
      const spaceNode = $createTextNode(' ');
      const textBeforeMention = textContent.slice(0, mentionOffset);
      const textNode = $createTextNode(textBeforeMention);

      const parent = lastNode.getParent();
      if (!parent) return;

      lastNode.remove();
      parent.append(textNode, mentionNode, spaceNode);
      spaceNode.select();
      editor.focus();
    });
    setShowSuggestions(false);
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (!showSuggestions || !suggestions.length) {
          return false;
        }

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            setSelectedIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : prev
            );
            return true;

          case 'ArrowUp':
            event.preventDefault();
            setSelectedIndex((prev) => prev > 0 ? prev - 1 : prev);
            return true;

          case 'Enter':
          case 'Tab':
            event.preventDefault();
            if (suggestions[selectedIndex]) {
              insertMention(suggestions[selectedIndex]);
            }
            return true;

          case 'Escape':
            event.preventDefault();
            setShowSuggestions(false);
            return true;

          default:
            return false;
        }
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, showSuggestions, suggestions, selectedIndex, insertMention]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const nodes = selection.getNodes();
        if (nodes.length === 0) return false;

        const firstNode = nodes[0];
        if ($isMentionNode(firstNode)) {
          firstNode.remove();
          return true;
        }

        editor.getEditorState().read(() => {
          const text = firstNode.getTextContent();
          checkForMentionPattern(text);
        });

        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, checkForMentionPattern]);

  const handleMentionSelect = useCallback((suggestion: MentionSuggestion, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    insertMention(suggestion);
  }, [insertMention]);

  return showSuggestions ? (
    <div
      className="absolute z-50 w-64 bg-background border rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto"
      style={{ top: mentionPosition.top, left: mentionPosition.left }}
    >
      {suggestions.length === 0 ? (
        <div className="p-2 text-sm text-muted-foreground">
          No results found
        </div>
      ) : (
        <div className="p-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.id}`}
              className={`flex items-center gap-2 p-2 rounded-sm cursor-pointer w-full text-left ${
                index === selectedIndex ? 'bg-accent' : 'hover:bg-accent'
              }`}
              onClick={(e) => handleMentionSelect(suggestion, e)}
              onMouseEnter={() => setSelectedIndex(index)}
              type="button"
            >
              {suggestion.type === 'user' ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={suggestion.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${suggestion.name}`} />
                  <AvatarFallback>{suggestion.name[0]}</AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm">{suggestion.name}</span>
                <span className="text-xs text-muted-foreground">
                  {suggestion.type === 'user' ? 'User' : 'Group'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;
}

interface LexicalEditorProps {
  onChange?: (text: string, rawState?: string) => void;
  initialValue?: string;
  initialState?: string;
  users: Array<{ id: number; username: string; avatar: string | null }>;
  groups?: Array<{ id: number; name: string }>;
  placeholder?: string;
  onClear?: () => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  setEditor?: (editor: any) => void;
  editorState?: string;
}

function InitialValuePlugin({ initialValue, initialState }: { initialValue?: string; initialState?: string }) {
  const [editor] = useLexicalComposerContext();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && (initialValue || initialState)) {
      editor.update(() => {
        const root = $getRoot();
        if (root.getTextContent() === '') {
          if (initialState) {
            const parsedState = JSON.parse(initialState);
            editor.setEditorState(editor.parseEditorState(parsedState));
          } else if (initialValue) {
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(initialValue));
            root.append(paragraph);
          }
        }
      });
      setInitialized(true);
    }
  }, [editor, initialValue, initialState, initialized]);

  return null;
}

function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.focus();
  }, [editor]);

  return null;
}

function ShortcutPlugin({ onSubmit }: { onSubmit?: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onSubmit) return;

    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        const isMac = navigator.platform.toLowerCase().includes('mac');
        const isModifierPressed = isMac ? event.metaKey : event.ctrlKey;

        if (isModifierPressed && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, onSubmit]);

  return null;
}

function LexicalErrorBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function LexicalEditor({
  onChange,
  initialValue = "",
  initialState,
  users,
  groups = [],
  placeholder,
  onClear,
  onSubmit,
  autoFocus,
  setEditor,
  editorState,
}: LexicalEditorProps) {
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

  const onEditorChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const text = root.getTextContent();
      onChange?.(text, JSON.stringify(editorState));
    });
  }, [onChange]);

  const clearContent = useCallback(() => {
    if (editorInstance) {
      editorInstance.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      });
      onClear?.();
    }
  }, [editorInstance, onClear]);

  const initialConfig = {
    namespace: "SocialPostEditor",
    theme,
    onError: (error: Error) => {
      console.error('Lexical Editor Error:', error);
    },
    nodes: [MentionNode],
  };

  useEffect(() => {
    return () => {
      if (setEditor) {
        setEditor(null);
      }
    };
  }, [setEditor]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative min-h-[100px] w-full border rounded-md">
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-[100px] outline-none px-3 leading-[1.5] pt-3"
            />
          }
          placeholder={
            <div className="absolute top-0 left-3 text-muted-foreground pointer-events-none transform translate-y-3">
              <span>{placeholder || "What's on your mind? Use @ to mention users or groups"}</span>
              {onSubmit && (
                <span className="ml-2 text-sm opacity-50">
                  {isMac ? (
                    <>
                      <Command className="w-4 h-4 inline mb-0.5" />
                      +Enter to post
                    </>
                  ) : (
                    <>Ctrl+Enter to post</>
                  )}
                </span>
              )}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={onEditorChange} />
        <HistoryPlugin />
        <MentionsPlugin users={users} groups={groups} />
        <InitialValuePlugin initialValue={initialValue} initialState={initialState} />
        <ShortcutPlugin onSubmit={onSubmit} />
        {autoFocus && <AutoFocusPlugin />}
      </div>
    </LexicalComposer>
  );
}

export default LexicalEditor;
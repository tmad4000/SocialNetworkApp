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

  isSimpleText(): boolean {
    return false;
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

  selectPrevious(anchorOffset?: number, focusOffset?: number): RangeSelection {
    const selection = this.createSelection();
    if (typeof anchorOffset === 'number') {
      selection.anchor.offset = anchorOffset;
    }
    if (typeof focusOffset === 'number') {
      selection.focus.offset = focusOffset;
    }
    $setSelection(selection);
    return selection;
  }

  selectNext(anchorOffset?: number, focusOffset?: number): RangeSelection {
    const selection = this.createSelection();
    if (typeof anchorOffset === 'number') {
      selection.anchor.offset = anchorOffset;
    }
    if (typeof focusOffset === 'number') {
      selection.focus.offset = focusOffset;
    }
    $setSelection(selection);
    return selection;
  }

  splitText(...splitOffsets: number[]): TextNode[] {
    return [this];
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      mentionName: this.__mention,
      mentionType: this.__type,
      type: 'mention',
      version: 1,
    };
  }

  static importJSON(serializedNode: any): MentionNode {
    const node = $createMentionNode(serializedNode.mentionName, serializedNode.mentionType);
    node.setTextContent(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
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

  // Helper function to check for @ pattern and update suggestions
  const checkForMentionPattern = (text: string) => {
    const match = text.match(/@(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();

      // Combine and filter both users and groups
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

      // Combine suggestions with groups first
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
  };

  useEffect(() => {
    const removeListener = editor.registerTextContentListener((text) => {
      checkForMentionPattern(text);
    });

    return removeListener;
  }, [editor, users, groups]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (!showSuggestions || !suggestions.length) {
          return false;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex((prev) => prev > 0 ? prev - 1 : prev);
          return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          if (suggestions[selectedIndex]) {
            insertMention(suggestions[selectedIndex]);
          }
          return true;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setShowSuggestions(false);
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, showSuggestions, suggestions, selectedIndex]);

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

        // Check for @ pattern after backspace
        editor.getEditorState().read(() => {
          const text = firstNode.getTextContent();
          checkForMentionPattern(text);
        });

        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, users, groups]);

  const insertMention = (suggestion: MentionSuggestion) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const nodes = selection.getNodes();
      const lastNode = nodes[nodes.length - 1];
      const textContent = lastNode.getTextContent();
      const mentionOffset = textContent.lastIndexOf('@');

      if (mentionOffset === -1) return;

      // Create mention node with type
      const mentionNode = $createMentionNode(suggestion.name, suggestion.type);
      const spaceNode = $createTextNode(' ');

      // Split text and replace mention
      const textBeforeMention = textContent.slice(0, mentionOffset);
      const textNode = $createTextNode(textBeforeMention);

      const parent = lastNode.getParent();
      if (!parent) return;

      // Replace the current node with our new nodes
      lastNode.remove();
      parent.append(textNode, mentionNode, spaceNode);

      // Move selection after the space
      spaceNode.select();
    });
    setShowSuggestions(false);
  };

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
            <div
              key={`${suggestion.type}-${suggestion.id}`}
              className={`flex items-center gap-2 p-2 rounded-sm cursor-pointer ${
                index === selectedIndex ? 'bg-accent' : 'hover:bg-accent'
              }`}
              onClick={() => insertMention(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
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
            </div>
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
            // If we have a serialized state, use that
            const parsedState = JSON.parse(initialState);
            editor.setEditorState(editor.parseEditorState(parsedState));
          } else if (initialValue) {
            // Otherwise use plain text
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

  // Add method to clear editor content
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
    onError: console.error,
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
        <EditorPlugin setEditor={setEditor} />
      </div>
    </LexicalComposer>
  );
}

function EditorPlugin({ setEditor }: { setEditor?: (editor: any) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (setEditor) {
      setEditor(editor);
    }
  }, [editor, setEditor]);

  return null;
}

export default LexicalEditor;
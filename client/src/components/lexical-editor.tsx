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
import { Command } from "lucide-react";

// Custom MentionNode implementation
export class MentionNode extends TextNode {
  __mention: string;

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mention, node.__text, node.__key);
  }

  constructor(mentionName: string, text?: string, key?: NodeKey) {
    super(text ?? `@${mentionName}`, key);
    this.__mention = mentionName;
  }

  createDOM(config: any): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.color = 'hsl(var(--primary))';
    dom.style.fontWeight = '500';
    dom.style.whiteSpace = 'nowrap';
    dom.classList.add('mention');
    dom.setAttribute('data-mention', this.__mention);
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
      type: 'mention',
      version: 1,
    };
  }

  static importJSON(serializedNode: any): MentionNode {
    const node = $createMentionNode(serializedNode.mentionName);
    node.setTextContent(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }
}

export function $createMentionNode(mentionName: string): MentionNode {
  return new MentionNode(mentionName);
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

function MentionsPlugin({ users }: { users: Array<{ id: number; username: string; avatar: string | null }> }) {
  const [editor] = useLexicalComposerContext();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState(users);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const removeListener = editor.registerTextContentListener((text) => {
      const match = text.match(/@(\w*)$/);
      if (match) {
        const query = match[1];
        const filtered = users.filter((user) =>
          user.username.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredUsers(filtered);
        setShowSuggestions(filtered.length > 0);
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
    });

    return removeListener;
  }, [editor, users]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (!showSuggestions || !filteredUsers.length) {
          return false;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredUsers.length - 1 ? prev + 1 : prev
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
          if (filteredUsers[selectedIndex]) {
            insertMention(filteredUsers[selectedIndex].username);
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
  }, [editor, showSuggestions, filteredUsers, selectedIndex]);

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

        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  const insertMention = (username: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const nodes = selection.getNodes();
      const lastNode = nodes[nodes.length - 1];
      const textContent = lastNode.getTextContent();
      const mentionOffset = textContent.lastIndexOf('@');

      if (mentionOffset === -1) return;

      // Create mention node
      const mentionNode = $createMentionNode(username);
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
      {filteredUsers.length === 0 ? (
        <div className="p-2 text-sm text-muted-foreground">
          No users found
        </div>
      ) : (
        <div className="p-1">
          {filteredUsers.map((user, index) => (
            <div
              key={user.id}
              className={`flex items-center gap-2 p-2 rounded-sm cursor-pointer ${
                index === selectedIndex ? 'bg-accent' : 'hover:bg-accent'
              }`}
              onClick={() => insertMention(user.username)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${user.username}`} />
                <AvatarFallback>{user.username[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{user.username}</span>
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
  placeholder?: string;
  onClear?: () => void;
  onSubmit?: () => void;
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

export default function LexicalEditor({
  onChange,
  initialValue = "",
  initialState,
  users,
  placeholder,
  onClear,
  onSubmit,
}: LexicalEditorProps) {
  const [editor, setEditor] = useState<any>(null);
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
  const shortcutText = `Press ${isMac ? '⌘' : 'Ctrl'}+Enter to ${onSubmit ? 'post' : 'save'}`;

  const onEditorChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const text = root.getTextContent();
      onChange?.(text, JSON.stringify(editorState));
    });
  }, [onChange]);

  // Add method to clear editor content
  const clearContent = useCallback(() => {
    if (editor) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      });
      onClear?.();
    }
  }, [editor, onClear]);

  const initialConfig = {
    namespace: "SocialPostEditor",
    theme,
    onError: console.error,
    nodes: [MentionNode],
  };

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
              <span>{placeholder || "What's on your mind? Use @ to mention users"}</span>
              {onSubmit && (
                <span className="ml-2 text-sm opacity-50">
                  ({isMac ? <Command className="w-4 h-4 inline mb-0.5" /> : 'Ctrl'}+Enter to {onSubmit ? 'post' : 'save'})
                </span>
              )}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={onEditorChange} />
        <HistoryPlugin />
        <MentionsPlugin users={users} />
        <InitialValuePlugin initialValue={initialValue} initialState={initialState} />
        <ShortcutPlugin onSubmit={onSubmit} />
      </div>
    </LexicalComposer>
  );
}
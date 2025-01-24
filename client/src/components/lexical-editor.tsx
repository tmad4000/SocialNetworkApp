import { useCallback, useEffect, useState } from "react";
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  EditorState,
  TextNode,
  NodeKey,
  LexicalNode,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    dom.classList.add('mention');
    dom.style.color = 'hsl(var(--primary))';
    dom.style.fontWeight = '500';
    return dom;
  }
}

export function $createMentionNode(mentionName: string): MentionNode {
  return new MentionNode(mentionName);
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}

const theme = {
  paragraph: "my-2",
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
    const removeTextListener = editor.registerTextContentListener((text) => {
      const match = text.match(/@(\w*)$/);
      if (match) {
        const query = match[1];
        const filtered = users.filter((user) => 
          user.username.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredUsers(filtered);
        setShowSuggestions(true);
        setSelectedIndex(0);

        // Get the current selection and calculate position
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

    const removeKeyListener = editor.registerCommand(
      'keydown',
      (event: KeyboardEvent) => {
        if (!showSuggestions) return false;

        switch (event.key) {
          case 'ArrowDown':
            setSelectedIndex((prev) => 
              prev < filteredUsers.length - 1 ? prev + 1 : prev
            );
            return true;
          case 'ArrowUp':
            setSelectedIndex((prev) => prev > 0 ? prev - 1 : prev);
            return true;
          case 'Enter':
          case 'Tab':
            if (filteredUsers[selectedIndex]) {
              event.preventDefault();
              insertMention(filteredUsers[selectedIndex].username);
              return true;
            }
            return false;
          case 'Escape':
            setShowSuggestions(false);
            return true;
          default:
            return false;
        }
      },
      1
    );

    return () => {
      removeTextListener();
      removeKeyListener();
    };
  }, [editor, users, showSuggestions, filteredUsers, selectedIndex]);

  const insertMention = (username: string) => {
    editor.update(() => {
      const root = $getRoot();
      const textContent = root.getTextContent();
      const lastAtPos = textContent.lastIndexOf('@');

      // Create new nodes
      const mentionNode = $createMentionNode(username);
      const spaceNode = $createTextNode(' ');

      // Get the current paragraph
      const paragraph = root.getFirstChild();
      if (!paragraph) return;

      // Remove the @ and any characters after it
      const textBeforeMention = textContent.slice(0, lastAtPos);
      paragraph.clear();
      paragraph.append($createTextNode(textBeforeMention));
      paragraph.append(mentionNode);
      paragraph.append(spaceNode);

      // Set selection after the space
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
  onChange?: (text: string) => void;
  initialValue?: string;
  users: Array<{ id: number; username: string; avatar: string | null }>;
}

function LexicalErrorBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default function LexicalEditor({ onChange, initialValue = "", users }: LexicalEditorProps) {
  const onEditorChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const text = root.getTextContent();
      onChange?.(text);
    });
  }, [onChange]);

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
            <ContentEditable className="min-h-[100px] outline-none p-3" />
          }
          placeholder={
            <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
              What's on your mind? Use @ to mention users
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={onEditorChange} />
        <HistoryPlugin />
        <MentionsPlugin users={users} />
      </div>
    </LexicalComposer>
  );
}
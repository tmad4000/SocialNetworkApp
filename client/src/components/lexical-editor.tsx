import { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  $getRoot,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  TextNode,
  NodeKey,
  DecoratorNode,
  EditorState,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

class MentionNode extends DecoratorNode<JSX.Element> {
  __mention: string;
  __username: string;
  __link: string | null;

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(
      node.__mention,
      node.__username,
      node.__link,
      node.__key
    );
  }

  constructor(mention: string, username: string, link: string | null = null, key?: NodeKey) {
    super(key);
    this.__mention = mention;
    this.__username = username;
    this.__link = link;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('span');
    dom.className = 'mention';
    dom.setAttribute('data-mention', this.__mention);
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <a
        href={this.__link || undefined}
        className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
      >
        <Avatar className="h-4 w-4">
          <AvatarImage src={`https://api.dicebear.com/7.x/avatars/svg?seed=${this.__username}`} />
          <AvatarFallback>{this.__username[0]}</AvatarFallback>
        </Avatar>
        @{this.__mention}
      </a>
    );
  }
}

function MentionsPlugin({ users }: { users: Array<{ id: number; username: string; avatar: string | null }> }) {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<typeof users>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

  const getQueryString = useCallback((text: string): string | null => {
    const match = /@(\w+)$/.exec(text);
    return match?.[1] ?? null;
  }, []);

  useEffect(() => {
    if (queryString === null) {
      setSuggestions([]);
      return;
    }

    const filtered = users.filter((user) =>
      user.username.toLowerCase().includes(queryString.toLowerCase())
    );
    setSuggestions(filtered);
    setSelectedIndex(0);
  }, [queryString, users]);

  useEffect(() => {
    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          setQueryString(null);
          return;
        }

        const anchor = selection.anchor;
        const node = anchor.getNode();
        if (!node) return;

        const textContent = node instanceof TextNode ? node.getTextContent() : '';
        const currentQuery = getQueryString(textContent);
        setQueryString(currentQuery);
      });
    });

    return () => {
      removeListener();
    };
  }, [editor, getQueryString]);

  useEffect(() => {
    const handleArrowKeys = (event: KeyboardEvent, command: string): boolean => {
      if (suggestions.length === 0) return false;

      if (command === KEY_ARROW_UP_COMMAND) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        return true;
      }

      if (command === KEY_ARROW_DOWN_COMMAND) {
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        return true;
      }

      return false;
    };

    const handleEnterOrTab = (event: KeyboardEvent): boolean => {
      if (suggestions.length === 0) return false;

      event.preventDefault();
      const selectedUser = suggestions[selectedIndex];
      if (!selectedUser) return true;

      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchor = selection.anchor;
        const currentNode = anchor.getNode();
        if (!(currentNode instanceof TextNode)) return;

        const textContent = currentNode.getTextContent();
        const mentionIndex = textContent.lastIndexOf('@');
        if (mentionIndex === -1) return;

        const nodesToReplace = [];
        if (mentionIndex > 0) {
          nodesToReplace.push($createTextNode(textContent.slice(0, mentionIndex)));
        }

        const mentionNode = new MentionNode(
          selectedUser.username,
          selectedUser.username,
          `/profile/${selectedUser.id}`
        );
        nodesToReplace.push(mentionNode);
        nodesToReplace.push($createTextNode(' '));

        const parent = currentNode.getParent();
        if (!parent) return;

        currentNode.replace(nodesToReplace[0]);
        let lastNode = nodesToReplace[0];
        for (let i = 1; i < nodesToReplace.length; i++) {
          lastNode.insertAfter(nodesToReplace[i]);
          lastNode = nodesToReplace[i];
        }
        lastNode.select();
      });

      setQueryString(null);
      return true;
    };

    return editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => handleArrowKeys(event, KEY_ARROW_UP_COMMAND),
      COMMAND_PRIORITY_LOW
    )
      && editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => handleArrowKeys(event, KEY_ARROW_DOWN_COMMAND),
        COMMAND_PRIORITY_LOW
      )
      && editor.registerCommand(
        KEY_ENTER_COMMAND,
        handleEnterOrTab,
        COMMAND_PRIORITY_LOW
      )
      && editor.registerCommand(
        KEY_TAB_COMMAND,
        handleEnterOrTab,
        COMMAND_PRIORITY_LOW
      )
      && editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          setQueryString(null);
          return true;
        },
        COMMAND_PRIORITY_LOW
      );
  }, [editor, suggestions, selectedIndex]);

  return queryString === null || suggestions.length === 0
    ? null
    : createPortal(
        <div
          ref={popupRef}
          className="absolute z-50 w-64 bg-background border rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto"
          style={{
            bottom: "100%",
            left: 0,
            marginBottom: "8px",
          }}
        >
          <div className="p-1">
            {suggestions.map((user, index) => (
              <div
                key={user.id}
                className={`flex items-center gap-2 p-2 rounded-sm cursor-pointer ${
                  index === selectedIndex ? 'bg-accent' : 'hover:bg-accent'
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  const event = new KeyboardEvent('keydown', { key: 'Enter' });
                  handleEnterOrTab(event);
                }}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatar || `https://api.dicebear.com/7.x/avatars/svg?seed=${user.username}`} />
                  <AvatarFallback>{user.username[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{user.username}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      );
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
    theme: {
      paragraph: "my-2",
      text: {
        base: "text-foreground",
      },
      mention: "text-primary font-medium",
    },
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
import { useCallback, useEffect } from "react";
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  EditorState,
  TextNode,
  NodeKey,
  SerializedTextNode,
  Spread,
  LexicalNode,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

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

  createDOM(): HTMLElement {
    const dom = super.createDOM();
    dom.classList.add('mention');
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

function MentionsPlugin({ users }: { users: Array<{ id: number; username: string }> }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeListener = editor.registerTextContentListener((text) => {
      const match = text.match(/@(\w+)$/);
      if (match) {
        const query = match[1];
        const filtered = users.filter((user) => 
          user.username.toLowerCase().includes(query.toLowerCase())
        );

        // Show mentions dropdown with filtered users
        console.log("Filtered users:", filtered);
      }
    });

    return () => {
      removeListener();
    };
  }, [editor, users]);

  return null;
}

interface LexicalEditorProps {
  onChange?: (text: string) => void;
  initialValue?: string;
  users: Array<{ id: number; username: string }>;
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
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
  SerializedTextNode,
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
import { useCallback, useEffect, useState } from "react";

// Node type definitions
interface SerializedUserMentionNode extends SerializedTextNode {
  username: string;
  type: 'user-mention';
  version: 1;
}

interface SerializedGroupMentionNode extends SerializedTextNode {
  groupName: string;
  type: 'group-mention';
  version: 1;
}

// User mention node
export class UserMentionNode extends TextNode {
  __username: string;

  static getType(): string {
    return 'user-mention';
  }

  static clone(node: UserMentionNode): UserMentionNode {
    return new UserMentionNode(node.__username, node.__key);
  }

  constructor(username: string, key?: NodeKey) {
    super(`@${username}`, key);
    this.__username = username;
  }

  createDOM(config: any): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.color = 'hsl(var(--muted-foreground))';
    dom.style.fontWeight = '500';
    dom.classList.add('mention', 'user-mention');
    return dom;
  }

  exportJSON(): SerializedUserMentionNode {
    return {
      ...super.exportJSON(),
      type: 'user-mention',
      username: this.__username,
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedUserMentionNode): UserMentionNode {
    const node = $createUserMentionNode(serializedNode.username);
    node.setTextContent(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }
}

// Group mention node with updated styling
export class GroupMentionNode extends TextNode {
  __groupName: string;

  static getType(): string {
    return 'group-mention';
  }

  static clone(node: GroupMentionNode): GroupMentionNode {
    return new GroupMentionNode(node.__groupName, node.__key);
  }

  constructor(groupName: string, key?: NodeKey) {
    super(`@${groupName}`, key);
    this.__groupName = groupName;
  }

  createDOM(config: any): HTMLElement {
    const dom = super.createDOM(config);
    dom.style.color = 'hsl(var(--primary))'; // Changed to primary color for groups
    dom.style.fontWeight = '600';
    dom.classList.add('mention', 'group-mention');
    return dom;
  }

  exportJSON(): SerializedGroupMentionNode {
    return {
      ...super.exportJSON(),
      type: 'group-mention',
      groupName: this.__groupName,
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedGroupMentionNode): GroupMentionNode {
    const node = $createGroupMentionNode(serializedNode.groupName);
    node.setTextContent(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }
}

// Helper functions
export function $createUserMentionNode(username: string): UserMentionNode {
  return new UserMentionNode(username);
}

export function $createGroupMentionNode(groupName: string): GroupMentionNode {
  return new GroupMentionNode(groupName);
}

export function $isUserMentionNode(node: LexicalNode | null | undefined): node is UserMentionNode {
  return node instanceof UserMentionNode;
}

export function $isGroupMentionNode(node: LexicalNode | null | undefined): node is GroupMentionNode {
  return node instanceof GroupMentionNode;
}

// Mentions plugin component
function MentionsPlugin({
  users,
  groups = [], // Default to empty array
}: {
  users: Array<{ id: number; username: string; avatar: string | null }>;
  groups: Array<{ id: number; name: string }>;
}) {
  const [editor] = useLexicalComposerContext();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: number; name: string; type: 'user' | 'group'; avatar?: string | null }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Updated pattern matching to handle spaces
  const checkForMentionPattern = useCallback((text: string) => {
    const match = text.match(/@([^@\n]*?)$/); // Updated regex to match any text after @ until end or newline
    if (match) {
      const query = match[1].toLowerCase();

      const userSuggestions = users
        .filter(user => user.username.toLowerCase().includes(query))
        .map(user => ({
          id: user.id,
          name: user.username,
          type: 'user' as const,
          avatar: user.avatar
        }));

      const groupSuggestions = groups
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

      // Position the suggestions dropdown
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
    return editor.registerTextContentListener((text) => {
      checkForMentionPattern(text);
    });
  }, [editor, checkForMentionPattern]);

  const insertMention = useCallback((suggestion: { name: string; type: 'user' | 'group' }) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const nodes = selection.getNodes();
      const lastNode = nodes[nodes.length - 1];
      const textContent = lastNode.getTextContent();
      const mentionOffset = textContent.lastIndexOf('@');

      if (mentionOffset === -1) return;

      const mentionNode = suggestion.type === 'user'
        ? $createUserMentionNode(suggestion.name)
        : $createGroupMentionNode(suggestion.name);
      const spaceNode = $createTextNode(' ');
      const textBeforeMention = textContent.slice(0, mentionOffset);
      const textNode = $createTextNode(textBeforeMention);

      const parent = lastNode.getParent();
      if (!parent) return;

      lastNode.remove();
      parent.append(textNode, mentionNode, spaceNode);
      spaceNode.select();
    });
    setShowSuggestions(false);
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (!showSuggestions || !suggestions.length) return false;

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            setSelectedIndex((prev) => prev < suggestions.length - 1 ? prev + 1 : prev);
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
        if ($isUserMentionNode(firstNode) || $isGroupMentionNode(firstNode)) {
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
              onClick={() => insertMention(suggestion)}
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

// Editor component props
interface LexicalEditorProps {
  onChange?: (text: string, rawState?: string) => void;
  initialValue?: string;
  initialState?: string;
  users: Array<{ id: number; username: string; avatar: string | null }>;
  groups?: Array<{ id: number; name: string }>;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}

// Main editor component
function LexicalEditor({
  onChange,
  initialValue,
  initialState,
  users,
  groups = [],
  placeholder,
  onSubmit,
  autoFocus,
}: LexicalEditorProps) {
  const initialConfig = {
    namespace: "SocialPostEditor",
    theme: {
      text: {
        base: "text-foreground",
      },
      mention: "text-primary font-medium",
    },
    onError: (error: Error) => {
      console.error('Lexical Editor Error:', error);
    },
    nodes: [UserMentionNode, GroupMentionNode],
    editable: true,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EditorContainer
        onChange={onChange}
        initialValue={initialValue}
        initialState={initialState}
        users={users}
        groups={groups}
        placeholder={placeholder}
        onSubmit={onSubmit}
        autoFocus={autoFocus}
      />
    </LexicalComposer>
  );
}

// Container component that uses the context
function EditorContainer({
  onChange,
  initialValue,
  initialState,
  users,
  groups,
  placeholder,
  onSubmit,
  autoFocus,
}: LexicalEditorProps) {
  const [editor] = useLexicalComposerContext();

  const clearContent = useCallback(() => {
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      const paragraph = $createParagraphNode();
      root.append(paragraph);
      onChange?.("", ""); // Clear both content and state
    });
  }, [editor, onChange]);

  const onEditorChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const text = root.getTextContent();
      onChange?.(text, JSON.stringify(editorState));
    });
  }, [onChange]);

  useEffect(() => {
    if (initialState === "") {
      clearContent();
    }
  }, [initialState, clearContent]);

  return (
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
                {navigator.platform.toLowerCase().includes('mac') ? (
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
      />
      <OnChangePlugin onChange={onEditorChange} />
      <HistoryPlugin />
      <MentionsPlugin users={users} groups={groups} />
      {initialValue && <InitialValuePlugin initialValue={initialValue} />}
      {initialState && <InitialStatePlugin initialState={initialState} />}
      {autoFocus && <AutoFocusPlugin />}
      {onSubmit && <ShortcutPlugin onSubmit={() => {
        onSubmit();
        clearContent();
      }} />}
    </div>
  );
}

// Plugin components
function InitialValuePlugin({ initialValue }: { initialValue: string }) {
  const [editor] = useLexicalComposerContext();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && initialValue) {
      editor.update(() => {
        const root = $getRoot();
        if (root.getTextContent() === '') {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(initialValue));
          root.append(paragraph);
        }
      });
      setInitialized(true);
    }
  }, [editor, initialValue, initialized]);

  return null;
}

function InitialStatePlugin({ initialState }: { initialState: string }) {
  const [editor] = useLexicalComposerContext();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && initialState) {
      const parsedState = JSON.parse(initialState);
      editor.setEditorState(editor.parseEditorState(parsedState));
      setInitialized(true);
    }
  }, [editor, initialState, initialized]);

  return null;
}

function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.focus();
  }, [editor]);

  return null;
}

function ShortcutPlugin({ onSubmit }: { onSubmit: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
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

export default LexicalEditor;
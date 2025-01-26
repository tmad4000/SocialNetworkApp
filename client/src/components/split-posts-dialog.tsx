import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SplitPostsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  postCount: number;
}

export default function SplitPostsDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  postCount,
}: SplitPostsDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Split into Multiple Posts?</AlertDialogTitle>
          <AlertDialogDescription>
            It looks like you have {postCount} separate ideas. Would you like to split this into {postCount} individual posts?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep as One Post</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Split into {postCount} Posts
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

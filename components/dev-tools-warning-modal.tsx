import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

interface DevToolsWarningModalProps {
  open: boolean;
  onClose: () => void;
  status: "warning" | "banned";
  warningCount: number;
  message: string;
}

export function DevToolsWarningModal({
  open,
  onClose,
  status,
  warningCount,
  message,
}: DevToolsWarningModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            {status === "banned" ? (
              <ShieldAlert className="h-8 w-8 text-destructive" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            )}
          </div>
          <AlertDialogTitle className="text-center text-xl">
            {status === "banned" 
              ? "Access Revoked" 
              : `Security Warning (${warningCount}/3)`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-center">
          <AlertDialogAction 
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            {status === "banned" ? "Return to Course" : "I Understand"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ContentBannedView({
  contentTitle,
  onReturn,
}: {
  contentTitle: string;
  onReturn: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 mb-6">
        <ShieldAlert className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold mb-2">Access Revoked</h1>
      <p className="text-xl text-muted-foreground mb-6">{contentTitle}</p>
      <p className="text-base max-w-md mb-8">
        Your access to this content has been suspended due to violations of our terms of service.
        Only the content creator or an administrator can restore your access.
      </p>
      <button
        onClick={onReturn}
        className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Return to Course Page
      </button>
    </div>
  );
}
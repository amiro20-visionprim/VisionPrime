import React from "react";
export declare function LoadingState({ label }: {
    label?: string;
}): React.JSX.Element;
export declare function EmptyState({ title, action }: {
    title: string;
    action?: React.ReactNode;
}): React.JSX.Element;
export declare function ErrorState({ message }: {
    message?: string;
}): React.JSX.Element;

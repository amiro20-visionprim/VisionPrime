import React from "react";
export interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}
/**
 * Shared page header per /docs/ui-ux-guidelines.md — every Admin OS
 * page should start with this instead of hand-rolled header markup.
 */
export declare function PageHeader({ title, description, actions }: PageHeaderProps): React.JSX.Element;

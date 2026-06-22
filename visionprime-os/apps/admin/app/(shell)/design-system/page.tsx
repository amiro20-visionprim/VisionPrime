"use client";

import { useState } from "react";
import {
  PageHeader,
  DataTable,
  EmptyState,
  LoadingState,
  ErrorState,
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  MultiSelect,
  Switch,
  Checkbox,
  Radio,
  Badge,
  StatusBadge,
  Card,
  MetricCard,
  Skeleton,
  Tabs,
  Modal,
  ConfirmDialog,
  Drawer,
  Tooltip,
  DropdownMenu,
  FilterBar,
  Can,
  useToast,
  StatusKey,
} from "@visionprime/ui";

interface SampleRow {
  id: string;
  name: string;
}

const STATUS_KEYS: StatusKey[] = ["active", "inactive", "pending", "processing", "completed", "failed", "cancelled", "draft"];

export default function DesignSystemPreviewPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [multiValue, setMultiValue] = useState<string[]>([]);
  const { showToast } = useToast();

  const sampleRows: SampleRow[] = [
    { id: "1", name: "Sample row A" },
    { id: "2", name: "Sample row B" },
  ];

  return (
    <div>
      <PageHeader title="Design System Preview" description="Shared @visionprime/ui components." />

      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "forms", label: "Forms" },
          { key: "overlays", label: "Overlays" },
        ]}
        activeKey={activeTab}
        onChange={setActiveTab}
      />

      <div style={{ marginTop: "1.5rem" }}>
        {activeTab === "overview" ? (
          <>
            <section style={{ marginBottom: "2rem" }}>
              <h2>Buttons</h2>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
                <Button isLoading>Loading</Button>
                <IconButton aria-label="Settings">⚙</IconButton>
              </div>
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>Badges &amp; status</h2>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Badge>Default badge</Badge>
                {STATUS_KEYS.map((status) => (
                  <StatusBadge key={status} status={status} />
                ))}
              </div>
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>Cards &amp; metrics</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                <MetricCard label="Total Customers" value="1,204" trend={{ direction: "up", label: "+4% this month" }} />
                <MetricCard label="Loading metric" value="—" isLoading />
                <Card>Plain card content.</Card>
              </div>
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>Skeleton</h2>
              <Skeleton />
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>DataTable — with FilterBar, rows &amp; row actions</h2>
              <DataTable<SampleRow>
                columns={[{ key: "name", header: "Name" }]}
                rows={sampleRows}
                filterSlot={<FilterBar searchValue={search} onSearchChange={setSearch} />}
                renderRowActions={(row) => (
                  <DropdownMenu
                    trigger={<IconButton aria-label={`Actions for ${row.name}`}>⋮</IconButton>}
                    items={[
                      { key: "edit", label: "Edit", onSelect: () => showToast(`Edit ${row.name}`) },
                      { key: "delete", label: "Delete", isDestructive: true, onSelect: () => setIsConfirmOpen(true) },
                    ]}
                  />
                )}
              />
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>DataTable — empty state</h2>
              <DataTable<SampleRow> columns={[{ key: "name", header: "Name" }]} rows={[]} />
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>Loading state</h2>
              <LoadingState />
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>Empty state</h2>
              <EmptyState title="No campaigns yet" />
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>Error state</h2>
              <ErrorState message="Failed to load data." />
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>Tooltip</h2>
              <Tooltip label="Helpful hint">
                <Button variant="secondary">Hover me</Button>
              </Tooltip>
            </section>

            <section style={{ marginBottom: "2rem" }}>
              <h2>Permission gate (Can)</h2>
              <Can permission="customers.delete" userPermissions={["customers.read"]} fallback={<span>Hidden — no permission.</span>}>
                <Button variant="danger">Delete (visible if permitted)</Button>
              </Can>
            </section>
          </>
        ) : null}

        {activeTab === "forms" ? (
          <section style={{ display: "grid", gap: "1rem", maxWidth: 420 }}>
            <Input placeholder="Text input" />
            <Textarea placeholder="Textarea" />
            <Select
              placeholder="Select an option"
              options={[
                { value: "a", label: "Option A" },
                { value: "b", label: "Option B" },
              ]}
            />
            <MultiSelect
              options={[
                { value: "a", label: "Option A" },
                { value: "b", label: "Option B" },
              ]}
              value={multiValue}
              onChange={setMultiValue}
            />
            <Switch aria-label="Enabled" checked onChange={() => undefined} />
            <Checkbox label="I agree" readOnly checked />
            <Radio name="sample" label="Choice 1" checked readOnly />
          </section>
        ) : null}

        {activeTab === "overlays" ? (
          <section style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
            <Button onClick={() => setIsConfirmOpen(true)}>Open ConfirmDialog</Button>
            <Button onClick={() => setIsDrawerOpen(true)}>Open Drawer</Button>
            <Button onClick={() => showToast("Saved successfully.", "success")}>Show Toast</Button>
          </section>
        ) : null}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Sample Modal">
        <p>Modal body content.</p>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Delete row"
        message="Are you sure you want to delete this row? This action cannot be undone."
        onConfirm={() => {
          setIsConfirmOpen(false);
          showToast("Deleted.", "success");
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />

      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="Sample Drawer">
        <p>Drawer body content.</p>
      </Drawer>
    </div>
  );
}

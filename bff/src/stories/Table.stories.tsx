import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SortableColumn, type SortDirection } from '@/components/ui/sortable-column';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const meta: Meta = {
  title: 'BeTrace/Table Components',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const SortableColumns: Story = {
  render: () => {
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);

    const handleSort = (column: string) => {
      if (sortColumn === column) {
        // Cycle through: null -> asc -> desc -> null
        if (sortDirection === null) {
          setSortDirection('asc');
        } else if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else {
          setSortDirection(null);
          setSortColumn(null);
        }
      } else {
        setSortColumn(column);
        setSortDirection('asc');
      }
    };

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold mb-4">Sortable Table Columns</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Click on column headers to sort. Cycles through: unsorted → ascending → descending → unsorted
          </p>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-gray-800">
                  <SortableColumn
                    sortDirection={sortColumn === 'name' ? sortDirection : null}
                    onSort={() => handleSort('name')}
                  >
                    Name
                  </SortableColumn>
                  <SortableColumn
                    sortDirection={sortColumn === 'status' ? sortDirection : null}
                    onSort={() => handleSort('status')}
                    className="w-32"
                  >
                    Status
                  </SortableColumn>
                  <SortableColumn
                    sortDirection={sortColumn === 'date' ? sortDirection : null}
                    onSort={() => handleSort('date')}
                    className="w-48"
                  >
                    Date
                  </SortableColumn>
                  <SortableColumn sortable={false} className="w-32 text-right">
                    Actions
                  </SortableColumn>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Example Item 1</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>2024-01-15</TableCell>
                  <TableCell className="text-right">
                    <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Example Item 2</TableCell>
                  <TableCell>Inactive</TableCell>
                  <TableCell>2024-01-14</TableCell>
                  <TableCell className="text-right">
                    <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Example Item 3</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>2024-01-13</TableCell>
                  <TableCell className="text-right">
                    <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Current Sort:</strong>{' '}
              {sortColumn ? (
                <>
                  {sortColumn} ({sortDirection || 'none'})
                </>
              ) : (
                'None'
              )}
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold mb-4">Column States</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Different visual states for sortable columns
          </p>

          <div className="space-y-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden inline-block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    <SortableColumn sortDirection={null} onSort={() => {}}>
                      Unsorted (Default)
                    </SortableColumn>
                  </TableRow>
                </TableHeader>
              </Table>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden inline-block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    <SortableColumn sortDirection="asc" onSort={() => {}}>
                      Sorted Ascending
                    </SortableColumn>
                  </TableRow>
                </TableHeader>
              </Table>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden inline-block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    <SortableColumn sortDirection="desc" onSort={() => {}}>
                      Sorted Descending
                    </SortableColumn>
                  </TableRow>
                </TableHeader>
              </Table>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden inline-block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800">
                    <SortableColumn sortable={false}>
                      Not Sortable
                    </SortableColumn>
                  </TableRow>
                </TableHeader>
              </Table>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

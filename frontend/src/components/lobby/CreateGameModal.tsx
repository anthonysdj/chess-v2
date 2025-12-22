'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (timeControl: number | null) => void;
  isCreating: boolean;
}

const TIME_CONTROLS = [
  { value: null, label: 'No limit', description: 'Take your time' },
  { value: 60, label: '1 minute', description: 'Fast-paced' },
  { value: 180, label: '3 minutes', description: 'Standard' },
  { value: 300, label: '5 minutes', description: 'Relaxed' },
];

export default function CreateGameModal({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}: CreateGameModalProps) {
  const [selectedTimeControl, setSelectedTimeControl] = useState<number | null>(180);

  const handleCreate = () => {
    onCreate(selectedTimeControl);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Game">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Time Control (per turn)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_CONTROLS.map((tc) => (
              <button
                key={tc.label}
                onClick={() => setSelectedTimeControl(tc.value)}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  selectedTimeControl === tc.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {tc.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {tc.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleCreate}
            isLoading={isCreating}
            disabled={isCreating}
          >
            Create Game
          </Button>
        </div>
      </div>
    </Modal>
  );
}

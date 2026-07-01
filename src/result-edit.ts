import { promptForEditField, promptForExecutionConfirmation } from './cli';
import { openFileInEditor, readFileText, resolveEditor } from './editor';
import { safeUnlink, tempFile } from './temp-files';
import type { Mode, ParsedResult } from './types';

export type EditFieldId = 'branchName' | 'commitMessage' | 'prTitle' | 'prDescription';

interface EditableField {
  id: EditFieldId;
  label: string;
  hint: string;
  getValue: (result: ParsedResult) => string;
  setValue: (result: ParsedResult, value: string) => ParsedResult;
}

const FIELD_HINTS: Record<EditFieldId, string> = {
  branchName: 'Edit branch name. Save and close when done.',
  commitMessage: 'Edit commit message (title and optional body). Save and close when done.',
  prTitle: 'Edit PR title. Save and close when done.',
  prDescription: 'Edit PR description. Save and close when done.',
};

function assertMode<T extends ParsedResult['mode']>(result: ParsedResult, mode: T): asserts result is Extract<ParsedResult, { mode: T }> {
  if (result.mode !== mode) {
    throw new Error(`Expected result mode ${mode}, got ${result.mode}`);
  }
}

function commitTitleLine(commitMessage: string): string {
  return commitMessage.split('\n')[0]?.trim() ?? '';
}

function editableFieldsForResult(result: ParsedResult): EditableField[] {
  switch (result.mode) {
    case 'commit-push':
      return [
        {
          id: 'commitMessage',
          label: 'Commit message',
          hint: FIELD_HINTS.commitMessage,
          getValue: (draft) => (draft.mode === 'commit-push' ? draft.commitMessage : ''),
          setValue: (draft, value) => {
            assertMode(draft, 'commit-push');
            return { ...draft, commitMessage: value.trim() };
          },
        },
      ];
    case 'branch-commit-push':
      return [
        {
          id: 'branchName',
          label: 'Branch name',
          hint: FIELD_HINTS.branchName,
          getValue: (draft) => (draft.mode === 'branch-commit-push' ? draft.branchName : ''),
          setValue: (draft, value) => {
            assertMode(draft, 'branch-commit-push');
            return { ...draft, branchName: value.trim() };
          },
        },
        {
          id: 'commitMessage',
          label: 'Commit message',
          hint: FIELD_HINTS.commitMessage,
          getValue: (draft) => (draft.mode === 'branch-commit-push' ? draft.commitMessage : ''),
          setValue: (draft, value) => {
            assertMode(draft, 'branch-commit-push');
            return { ...draft, commitMessage: value.trim() };
          },
        },
      ];
    case 'branch-commit-pr':
      return [
        {
          id: 'branchName',
          label: 'Branch name',
          hint: FIELD_HINTS.branchName,
          getValue: (draft) => (draft.mode === 'branch-commit-pr' ? draft.branchName : ''),
          setValue: (draft, value) => {
            assertMode(draft, 'branch-commit-pr');
            return { ...draft, branchName: value.trim() };
          },
        },
        {
          id: 'commitMessage',
          label: 'Commit message',
          hint: FIELD_HINTS.commitMessage,
          getValue: (draft) => (draft.mode === 'branch-commit-pr' ? draft.commitMessage : ''),
          setValue: (draft, value) => {
            assertMode(draft, 'branch-commit-pr');
            const commitMessage = value.trim();
            return {
              ...draft,
              commitMessage,
              title: commitTitleLine(commitMessage) || draft.title,
            };
          },
        },
        {
          id: 'prTitle',
          label: 'PR title',
          hint: FIELD_HINTS.prTitle,
          getValue: (draft) => (draft.mode === 'branch-commit-pr' ? draft.title : ''),
          setValue: (draft, value) => {
            assertMode(draft, 'branch-commit-pr');
            return { ...draft, title: value.trim() };
          },
        },
        {
          id: 'prDescription',
          label: 'PR description',
          hint: FIELD_HINTS.prDescription,
          getValue: (draft) => (draft.mode === 'branch-commit-pr' ? draft.prDescription : ''),
          setValue: (draft, value) => {
            assertMode(draft, 'branch-commit-pr');
            return { ...draft, prDescription: value.trim() };
          },
        },
      ];
    case 'create-pr':
    case 'update-pr':
      return [
        {
          id: 'prTitle',
          label: 'PR title',
          hint: FIELD_HINTS.prTitle,
          getValue: (draft) =>
            draft.mode === 'create-pr' || draft.mode === 'update-pr' ? draft.title : '',
          setValue: (draft, value) => {
            assertMode(draft, result.mode);
            return { ...draft, title: value.trim() };
          },
        },
        {
          id: 'prDescription',
          label: 'PR description',
          hint: FIELD_HINTS.prDescription,
          getValue: (draft) =>
            draft.mode === 'create-pr' || draft.mode === 'update-pr' ? draft.prDescription : '',
          setValue: (draft, value) => {
            assertMode(draft, result.mode);
            return { ...draft, prDescription: value.trim() };
          },
        },
      ];
  }
}

export function getEditableFields(result: ParsedResult): EditableField[] {
  return editableFieldsForResult(result);
}

export function stripEditComments(content: string): string {
  return content
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
    .trim();
}

async function editTextInEditor(hint: string, initial: string): Promise<string> {
  const editPath = tempFile('git-ai-edit', 'md');

  try {
    await Bun.write(editPath, `# ${hint}\n\n${initial}`);
    console.log(`Opening ${resolveEditor()}...`);
    await openFileInEditor(editPath);

    const edited = stripEditComments(await readFileText(editPath));
    if (!edited) {
      throw new Error('Edited text is empty');
    }

    return edited;
  } finally {
    await safeUnlink(editPath);
  }
}

export async function editResultField(result: ParsedResult, fieldId: EditFieldId): Promise<ParsedResult> {
  const field = editableFieldsForResult(result).find((item) => item.id === fieldId);
  if (!field) {
    throw new Error(`Unknown edit field: ${fieldId}`);
  }

  const edited = await editTextInEditor(field.hint, field.getValue(result));
  return field.setValue(result, edited);
}

export async function editResultInteractively(result: ParsedResult): Promise<ParsedResult | null> {
  const fields = editableFieldsForResult(result);
  const fieldId = await promptForEditField<EditFieldId>(
    fields.map((field) => ({ id: field.id, label: field.label })),
  );

  if (!fieldId) return null;

  return editResultField(result, fieldId);
}

export async function confirmParsedResult(
  mode: Mode,
  initial: ParsedResult,
  preview: (result: ParsedResult) => void,
): Promise<ParsedResult | null> {
  let result = initial;

  while (true) {
    preview(result);

    const action = await promptForExecutionConfirmation();
    if (action === 'no') return null;

    if (action === 'edit') {
      try {
        const edited = await editResultInteractively(result);
        if (edited) {
          if (edited.mode !== mode) {
            throw new Error(`Edited draft does not match mode ${mode}`);
          }
          result = edited;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Edit canceled';
        console.log(`${message}.`);
      }
      continue;
    }

    return result;
  }
}

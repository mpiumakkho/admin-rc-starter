import { useState, type ChangeEvent, type DragEvent, type HTMLAttributes } from 'react';

import { lucideCloudUpload, lucideX } from '../../../icons';
import { cx } from '../core/types';
import { NgIcon } from '../icon/icon';
import './file-dropzone.scss';

export interface UiFileDropzoneProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  accept?: string;
  preview?: string | null;
  title?: string;
  hint?: string;
  removeLabel?: string;
  compact?: boolean;
  onFileSelected?: (file: File) => void;
  onRemoved?: () => void;
}

/**
 * Click or drop a file. Shows `preview` (an image URL) when set, with a button to remove it.
 * Set `compact` to lay it out as one row, for a field among other fields.
 *
 *   <UiFileDropzone accept="image/*" preview={avatar} onFileSelected={read} onRemoved={() => setAvatar('')}
 *     title="Click to upload or drag and drop" hint="PNG or JPG, up to 2 MB" />
 */
export function UiFileDropzone({
  accept = '', preview = '', title = 'Click to upload or drag and drop', hint = '', removeLabel = 'Remove', compact, onFileSelected, onRemoved,
  className, ...rest
}: UiFileDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected?.(file);
    }
    // Lets the same file be picked again after removing it
    event.target.value = '';
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      onFileSelected?.(file);
    }
  };

  return (
    <ui-file-dropzone {...rest} className={cx('ui-file-dropzone', compact && 'ui-file-dropzone-compact', className)}>
      <label className={cx('ui-drop', dragging && 'ui-drop-over')}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        <input type="file" className="ui-sr-only" accept={accept} onChange={pick} />
        {preview ? <img className="ui-drop-preview" src={preview} alt="" /> : <span className="ui-drop-icon"><NgIcon svg={lucideCloudUpload} /></span>}
        <span className="ui-drop-text">
          <span className="ui-drop-title">{title}</span>
          {hint && <span className="ui-drop-hint">{hint}</span>}
        </span>
      </label>
      {preview && (
        <button type="button" className="ui-drop-remove" aria-label={removeLabel} onClick={() => onRemoved?.()}>
          <NgIcon svg={lucideX} />
        </button>
      )}
    </ui-file-dropzone>
  );
}

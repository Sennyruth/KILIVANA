import { Component, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-image-upload',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styleUrl: './image-upload.scss',
  templateUrl: './image-upload.html',
})
export class ImageUpload {
  protected readonly files = signal<File[]>([]);
  protected readonly previews = signal<string[]>([]);
  protected readonly uploading = signal(false);
  protected readonly dragOver = signal(false);
  protected readonly uploadProgress = signal(0);
  protected readonly maxFiles = 5;
  protected readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  protected readonly compressionQuality = 0.7; // 70% quality
  protected readonly maxWidth = 1920; // Max width for compression
  protected readonly maxHeight = 1080; // Max height for compression

  protected readonly filesSelected = output<File[]>();
  protected readonly uploaded = output<string[]>();
  protected readonly error = output<string>();

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    if (selected.length === 0) return;

    const remaining = this.maxFiles - this.files().length;
    const toAdd = selected.slice(0, remaining);

    if (selected.length > remaining) {
      this.error.emit(`Only ${remaining} more image(s) allowed.`);
    }

    const valid = toAdd.filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) return;

    // Compress images and add to files
    this.compressImages(valid);
  }

  private async compressImages(imageFiles: File[]): Promise<void> {
    this.uploading.set(true);
    this.uploadProgress.set(0);

    const compressedFiles: File[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      try {
        const compressed = await this.compressImage(file);
        compressedFiles.push(compressed);
        
        // Update progress
        this.uploadProgress.set(Math.round(((i + 1) / imageFiles.length) * 100));
      } catch (err) {
        console.error('Failed to compress image:', err);
        // Use original file if compression fails
        compressedFiles.push(file);
      }
    }

    this.files.update((prev) => [...prev, ...compressedFiles]);
    
    // Generate previews from compressed files
    compressedFiles.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.previews.update((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(f);
    });

    this.filesSelected.emit(compressedFiles);
    this.uploading.set(false);
    this.uploadProgress.set(0);
  }

  private compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > this.maxWidth || height > this.maxHeight) {
            const ratio = Math.min(this.maxWidth / width, this.maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            file.type,
            this.compressionQuality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  protected remove(index: number): void {
    this.files.update((prev) => prev.filter((_, i) => i !== index));
    this.previews.update((prev) => prev.filter((_, i) => i !== index));
  }

  protected clear(): void {
    this.files.set([]);
    this.previews.set([]);
  }
}
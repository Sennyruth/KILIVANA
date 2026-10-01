import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product } from '../../../../core/services/product';
import { ImageUpload } from '../../../../shared/image-upload/image-upload';
import type { ProductCategory, ProductImage, ProductType } from '../../../../shared/product.model';

@Component({
  selector: 'app-add-product',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    ImageUpload,
  ],
  styleUrl: './add-product.scss',
  templateUrl: './add-product.html',
})
export class AddProduct implements OnInit {
  protected readonly productService = inject(Product);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
    category: ['', [Validators.required]],
    price: ['', [Validators.required, Validators.min(1)]],
    quantity: ['', [Validators.required, Validators.min(1)]],
    unit: ['', [Validators.required]],
    available: [true],
  });

  protected readonly categories = this.productService.categories;
  protected readonly units = ['kg', 'g', 'liters', 'pieces', 'bunches', 'crates'];
  protected readonly loading = computed(() => this.productService.loading());
  protected readonly selectedImages = signal<File[]>([]);

  ngOnInit(): void {
    if (this.categories().length === 0) {
      this.productService.loadAll().subscribe();
    }
  }

  protected onFilesSelected(files: File[]): void {
    this.selectedImages.set(files);
  }

  protected onUploadComplete(urls: string[]): void {
    this.createProduct(urls);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please fill in all required fields', 'Close', { duration: 3000 });
      return;
    }

    if (this.selectedImages().length === 0) {
      this.snackBar.open('Please add at least one product image', 'Close', { duration: 3000 });
      return;
    }

    // Upload images first
    this.productService.uploadImages(this.selectedImages()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.createProduct(res.data.urls);
        } else {
          this.snackBar.open(res.message || 'Failed to upload images', 'Close', { duration: 5000 });
        }
      },
      error: () => {
        this.snackBar.open('Failed to upload images', 'Close', { duration: 5000 });
      },
    });
  }

  private createProduct(imageUrls: string[]): void {
    const formValue = this.form.value;
    const productData = {
      name: formValue.name,
      description: formValue.description,
      category: formValue.category as ProductCategory,
      price: Number(formValue.price),
      quantity: Number(formValue.quantity),
      unit: formValue.unit,
      available: formValue.available,
      images: imageUrls.map((url, i) => ({ id: `img-${i}`, url, alt: formValue.name, isPrimary: i === 0 })) as ProductImage[],
      type: 'PRODUCE' as ProductType,
    };

    this.productService.create(productData).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Product added successfully!', 'Close', { duration: 3000 });
          this.router.navigate(['/dashboard/farmer']);
        } else {
          this.snackBar.open(res.message || 'Failed to add product', 'Close', { duration: 5000 });
        }
      },
      error: () => {
        this.snackBar.open('Failed to add product', 'Close', { duration: 5000 });
      },
    });
  }

  protected cancel(): void {
    this.router.navigate(['/dashboard/farmer']);
  }
}

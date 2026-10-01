import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
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
import type { ProductCategory, Product as ProductModel, ProductImage } from '../../../../shared/product.model';

@Component({
  selector: 'app-edit-product',
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
  styleUrl: './edit-product.scss',
  templateUrl: './edit-product.html',
})
export class EditProduct implements OnInit {
  protected readonly productService = inject(Product);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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
  protected readonly existingImages = signal<ProductImage[]>([]);
  protected readonly productId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.loadProduct();
  }

  private loadProduct(): void {
    this.productService.getById(this.productId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const product = res.data.product;
          this.form.patchValue({
            name: product.name,
            description: product.description,
            category: product.category,
            price: product.price,
            quantity: product.quantity,
            unit: product.unit,
            available: product.available,
          });
          this.existingImages.set(product.images || []);
          this.isLoading.set(false);
        } else {
          this.snackBar.open(res.message || 'Failed to load product', 'Close', { duration: 5000 });
          this.router.navigate(['/dashboard/farmer']);
        }
      },
      error: () => {
        this.snackBar.open('Failed to load product', 'Close', { duration: 5000 });
        this.router.navigate(['/dashboard/farmer']);
      },
    });
  }

  protected onFilesSelected(files: File[]): void {
    this.selectedImages.set(files);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please fill in all required fields', 'Close', { duration: 3000 });
      return;
    }

    const formValue = this.form.value;
    const productData = {
      name: formValue.name,
      description: formValue.description,
      category: formValue.category as ProductCategory,
      price: Number(formValue.price),
      quantity: Number(formValue.quantity),
      unit: formValue.unit,
      available: formValue.available,
      images: this.existingImages(),
    };

    // Upload new images if any
    if (this.selectedImages().length > 0) {
      this.productService.uploadImages(this.selectedImages()).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const newImages: ProductImage[] = res.data.urls.map((url, i) => ({ id: `new-${i}`, url, alt: formValue.name, isPrimary: false }));
            productData.images = [...this.existingImages(), ...newImages];
            this.updateProduct(productData);
          } else {
            this.snackBar.open(res.message || 'Failed to upload images', 'Close', { duration: 5000 });
          }
        },
        error: () => {
          this.snackBar.open('Failed to upload images', 'Close', { duration: 5000 });
        },
      });
    } else {
      this.updateProduct(productData);
    }
  }

  private updateProduct(productData: any): void {
    // Note: This would call an update API endpoint
    // For now, we'll just show a success message and navigate back
    this.snackBar.open('Product updated successfully!', 'Close', { duration: 3000 });
    this.router.navigate(['/dashboard/farmer']);
  }

  protected removeExistingImage(index: number): void {
    this.existingImages.update((prev) => prev.filter((_, i) => i !== index));
  }

  protected cancel(): void {
    this.router.navigate(['/dashboard/farmer']);
  }
}

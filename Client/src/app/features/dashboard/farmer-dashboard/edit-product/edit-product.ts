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
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product } from '../../../../core/services/product';
import { ImageUpload } from '../../../../shared/image-upload/image-upload';
import type { ProductImage } from '../../../../shared/product.model';
import { NotificationService } from '../../../../shared/notification/notification.service';

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
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
    category: [null as number | null, [Validators.required]],
    price: ['', [Validators.required, Validators.min(1)]],
    quantity: ['', [Validators.required, Validators.min(1)]],
    unit: ['', [Validators.required]],
    minimumOrderQty: [1, [Validators.required, Validators.min(1)]],
  });

  protected readonly categories = computed(() =>
    this.productService.categories().filter(
      (category) => category.type === 'FARMER',
    ),
  );
  protected readonly units = ['kg', 'g', 'liters', 'pieces', 'bunches', 'crates'];
  protected readonly submitting = signal<boolean>(false);
  protected readonly selectedImages = signal<File[]>([]);
  protected readonly existingImages = signal<ProductImage[]>([]);
  protected readonly productId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly isLoading = signal(true);

  protected get canSubmit(): boolean {
    return !this.submitting() && !this.isLoading() && this.form.valid;
  }

  ngOnInit(): void {
    this.loadProduct();
  }

  private loadProduct(): void {
    this.productService.getById(this.productId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const product = res.data;
          this.form.patchValue({
            name: product.name,
            description: product.description,
            category: product.categoryId ?? null,
            price: product.price,
            quantity: product.quantity,
            unit: product.unit,
            minimumOrderQty: product.minimumOrderQty ?? 1,
          });
          this.existingImages.set(product.images || []);
          this.isLoading.set(false);
        } else {
          this.notification.error(res.message || 'Failed to load product');
          this.router.navigate(['/dashboard/farmer']);
        }
      },
      error: () => {
        this.notification.error('Failed to load product');
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
      this.notification.warning('Please fill in all required fields');
      return;
    }

    this.submitting.set(true);

    if (this.selectedImages().length > 0) {
      this.productService.uploadImages(this.productId, this.selectedImages()).subscribe({
        next: (res) => {
          if (res.success) {
            this.updateProduct();
          } else {
            this.submitting.set(false);
            this.notification.error(res.message || 'Failed to upload images');
          }
        },
        error: (error) => {
          this.submitting.set(false);
          this.notification.error(this.uploadErrorMessage(error));
        },
      });
    } else {
      this.updateProduct();
    }
  }

  private updateProduct(): void {
    const formValue = this.form.value;
    const productData = {
      name: formValue.name,
      description: formValue.description,
      categoryId: Number(formValue.category),
      price: Number(formValue.price),
      quantity: Number(formValue.quantity),
      unit: formValue.unit,
      minimumOrderQty: Number(formValue.minimumOrderQty),
    };

    this.productService.update(this.productId, productData).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.notification.success('Product updated successfully!');
          this.router.navigate(['/dashboard/farmer']);
        } else {
          this.notification.error(res.message || 'Failed to update product');
        }
      },
      error: (err) => {
        this.submitting.set(false);

        let errorMessage = 'Failed to update product';
        if (err.error?.message) {
          errorMessage = err.error.message;
          if (errorMessage.includes('conflicts with existing data')) {
            errorMessage = 'A product with this name already exists. Please try a more specific name.';
          }
        } else if (err.error?.error) {
          errorMessage = err.error.error;
        } else if (typeof err.error === 'string') {
          errorMessage = err.error;
        }

        this.notification.error(errorMessage);
      },
    });
  }

  protected removeExistingImage(index: number): void {
    const image = this.existingImages()[index];
    if (!image) return;

    this.productService.deleteImage(this.productId, image.id).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notification.error(response.message || 'Failed to remove image');
          return;
        }
        this.existingImages.update((images) => images.filter((item) => item.id !== image.id));
      },
      error: (error: { error?: { message?: string } }) => {
        this.notification.error(error.error?.message || 'Failed to remove image');
      },
    });
  }

  private uploadErrorMessage(error: {
    error?: { message?: string; error?: { details?: string } };
    message?: string;
  }): string {
    return (
      error.error?.message ??
      error.error?.error?.details ??
      error.message ??
      'Failed to upload images'
    );
  }

  protected cancel(): void {
    this.router.navigate(['/dashboard/farmer']);
  }
}
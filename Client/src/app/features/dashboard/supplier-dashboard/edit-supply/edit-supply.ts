import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product } from '../../../../core/services/product';
import { ImageUpload } from '../../../../shared/image-upload/image-upload';
import type { ProductImage } from '../../../../shared/product.model';
import { NotificationService } from '../../../../shared/notification/notification.service';

@Component({
  selector: 'app-edit-supply',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    ImageUpload,
  ],
  styleUrl: './edit-supply.scss',
  templateUrl: './edit-supply.html',
})
export class EditSupply implements OnInit {
  protected readonly productService = inject(Product);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
    category: [null as number | null, [Validators.required]],
    price: ['', [Validators.required, Validators.min(0.01)]],
    quantity: ['', [Validators.required, Validators.min(1)]],
    minimumOrderQty: [1, [Validators.required, Validators.min(1)]],
    unit: ['', [Validators.required]],
  });

  protected readonly categories = computed(() =>
    this.productService.categories().filter((category) => category.type === 'SUPPLIER'),
  );
  protected readonly categoriesLoading = this.productService.categoriesLoading;
  protected readonly categoriesError = this.productService.categoriesError;
  protected readonly units = ['kg', 'liters', 'pieces', 'bags', 'boxes', 'units'];
  protected readonly submitting = signal<boolean>(false);
  protected readonly selectedImages = signal<File[]>([]);
  protected readonly existingImages = signal<ProductImage[]>([]);
  protected readonly supplyId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly isLoading = signal(true);

  protected get canSubmit(): boolean {
    return !this.submitting() && !this.isLoading() && this.form.valid;
  }

  ngOnInit(): void {
    if (!this.categoriesLoading() && this.productService.categories().length === 0) {
      this.productService.reloadCategories();
    }
    this.loadSupply();
  }

  protected reloadCategories(): void {
    this.productService.reloadCategories();
  }

  private loadSupply(): void {
    this.productService.getById(this.supplyId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const supply = res.data;
          this.form.patchValue({
            name: supply.name,
            description: supply.description,
            category: supply.categoryId ?? null,
            price: supply.price,
            quantity: supply.quantity,
            minimumOrderQty: supply.minimumOrderQty ?? 1,
            unit: supply.unit,
          });
          this.existingImages.set(supply.images || []);
          this.isLoading.set(false);
        } else {
          this.notification.error(res.message || 'Failed to load supply');
          this.router.navigate(['/dashboard/supplier']);
        }
      },
      error: () => {
        this.notification.error('Failed to load supply');
        this.router.navigate(['/dashboard/supplier']);
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
      this.productService.uploadImages(this.supplyId, this.selectedImages()).subscribe({
        next: (res) => {
          if (res.success) {
            this.updateSupply();
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
      this.updateSupply();
    }
  }

  private updateSupply(): void {
    const formValue = this.form.value;
    const supplyData = {
      name: formValue.name,
      description: formValue.description,
      categoryId: Number(formValue.category),
      price: Number(formValue.price),
      quantity: Number(formValue.quantity),
      unit: formValue.unit,
      minimumOrderQty: Number(formValue.minimumOrderQty),
    };

    this.productService.update(this.supplyId, supplyData).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.notification.success('Supply updated successfully!');
          this.router.navigate(['/dashboard/supplier']);
        } else {
          this.notification.error(res.message || 'Failed to update supply');
        }
      },
      error: (err) => {
        this.submitting.set(false);

        let errorMessage = 'Failed to update supply';
        if (err.error?.message) {
          errorMessage = err.error.message;
          if (errorMessage.includes('conflicts with existing data')) {
            errorMessage = 'A supply with this name already exists. Please try a more specific name.';
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

    this.productService.deleteImage(this.supplyId, image.id).subscribe({
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
    this.router.navigate(['/dashboard/supplier']);
  }
}
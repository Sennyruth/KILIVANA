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
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product, ListingFormData } from '../../../../core/services/product';
import { ImageUpload } from '../../../../shared/image-upload/image-upload';
import { INPUT_CATEGORY_NAMES } from '../../../../shared/product.model';
import { NotificationService } from '../../../../shared/notification/notification.service';

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
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
    category: [null as number | null, [Validators.required]], // holds the category ID
    price: ['', [Validators.required, Validators.min(0.01)]],
    quantity: ['', [Validators.required, Validators.min(1)]], // sent as stockQty
    minimumOrderQty: [1, [Validators.required, Validators.min(1)]],
    unit: ['', [Validators.required]],
    available: [true], // not part of the backend schema, kept for the UI only
  });

  /** Produce categories only: everything that is not a farm-input category. */
  protected readonly categories = computed(() =>
    this.productService
      .categories()
      .filter((c) => !INPUT_CATEGORY_NAMES.includes(c.name.toUpperCase())),
  );

  protected readonly units = ['kg', 'g', 'liters', 'pieces', 'bunches', 'crates'];
  protected readonly submitting = signal<boolean>(false);
  protected readonly selectedImages = signal<File[]>([]);

  protected get canSubmit(): boolean {
    return !this.submitting() && this.form.valid && this.selectedImages().length > 0;
  }

  ngOnInit(): void {
    if (this.productService.categories().length === 0) {
      this.productService.reloadCategories();
    }
  }

  protected onFilesSelected(files: File[]): void {
    this.selectedImages.set(files);
  }

  protected submit(): void {
    if (this.submitting()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notification.warning('Please fill in all required fields');
      return;
    }

    if (this.selectedImages().length === 0) {
      this.notification.warning('Please add at least one product image');
      return;
    }

    this.submitting.set(true);
    this.createProduct();
  }

  private createProduct(): void {
    const v = this.form.value;
    const selected = this.categories().find((c) => c.id === v.category);

    if (!selected) {
      this.submitting.set(false);
      this.notification.error('Please choose a valid category');
      return;
    }

    const data: ListingFormData = {
      categoryId: selected.id,
      name: v.name,
      description: v.description,
      unit: v.unit,
      price: Number(v.price),
      stockQty: Number(v.quantity),
      minimumOrderQty: Number(v.minimumOrderQty),
    };

    this.productService.createListingWithImages('farmer', data, this.selectedImages()).subscribe({
      next: (res) => {
        if (!res.success || !res.data) {
          this.submitting.set(false);
          this.notification.error(res.message || 'Failed to add product');
          return;
        }

        this.submitting.set(false);
        this.notification.success('Product added successfully!');
        this.router.navigate(['/dashboard/farmer']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.notification.error(this.errorMessage(err));
      },
    });
  }

  private errorMessage(err: any): string {
    const body = err?.error;
    if (typeof body === 'string') return body.length > 200 ? 'Failed to add product' : body;

    // Validation errors list the failing fields in `data`
    if (body?.error?.code === 'VALIDATION_ERROR' && body.data && typeof body.data === 'object') {
      return Object.values(body.data).join('. ');
    }
    if (body?.error?.code === 'DATA_INTEGRITY_VIOLATION') {
      return body.error.details || 'The server rejected this product.';
    }
    if (body?.error?.code === 'CONFLICT') {
      return body.error.details || 'A product with these details already exists.';
    }
    return body?.message || 'Failed to add product';
  }

  protected cancel(): void {
    this.router.navigate(['/dashboard/farmer']);
  }
}
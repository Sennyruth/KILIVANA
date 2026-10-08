import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Product, ListingFormData } from '../../../../core/services/product';
import { ImageUpload } from '../../../../shared/image-upload/image-upload';
import { NotificationService } from '../../../../shared/notification/notification.service';

@Component({
  selector: 'app-add-supply',
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
  styleUrl: './add-supply.scss',
  templateUrl: './add-supply.html',
})
export class AddSupply implements OnInit {
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
  });

  /** The backend category type identifies which options suppliers may select. */
  protected readonly categories = computed(() =>
    this.productService.categories().filter((category) => category.type === 'SUPPLIER'),
  );
  protected readonly categoriesLoading = this.productService.categoriesLoading;
  protected readonly categoriesError = this.productService.categoriesError;

  protected readonly units = ['kg', 'liters', 'pieces', 'bags', 'boxes', 'units'];
  protected readonly submitting = signal<boolean>(false);
  protected readonly selectedImages = signal<File[]>([]);

  protected get canSubmit(): boolean {
    return !this.submitting() && this.form.valid && this.selectedImages().length > 0;
  }

  ngOnInit(): void {
    if (!this.productService.categoriesLoading() && this.productService.categories().length === 0) {
      this.productService.reloadCategories();
    }
  }

  protected reloadCategories(): void {
    this.productService.reloadCategories();
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
      this.notification.warning('Please add at least one supply image');
      return;
    }

    this.submitting.set(true);
    this.createSupply();
  }

  private createSupply(): void {
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

    this.productService.createListingWithImages('supplier', data, this.selectedImages()).subscribe({
      next: (res) => {
        if (!res.success || !res.data) {
          this.submitting.set(false);
          this.notification.error(res.message || 'Failed to add supply');
          return;
        }

        this.submitting.set(false);
        this.notification.success('Supply added successfully!');
        this.router.navigate(['/dashboard/supplier']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.notification.error(this.errorMessage(err));
      },
    });
  }

  private errorMessage(err: any): string {
    const body = err?.error;
    if (typeof body === 'string') return body.length > 200 ? 'Failed to add supply' : body;

    // Validation errors list the failing fields in `data`
    if (body?.error?.code === 'VALIDATION_ERROR' && body.data && typeof body.data === 'object') {
      return Object.values(body.data).join('. ');
    }
    if (body?.error?.code === 'DATA_INTEGRITY_VIOLATION') {
      return body.error.details || 'The server rejected this supply.';
    }
    if (body?.error?.code === 'CONFLICT') {
      return body.error.details || 'A supply with these details already exists.';
    }
    return body?.message || 'Failed to add supply';
  }

  protected cancel(): void {
    this.router.navigate(['/dashboard/supplier']);
  }
}
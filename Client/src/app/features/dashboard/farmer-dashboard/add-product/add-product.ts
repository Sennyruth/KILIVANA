import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
import { Farmer } from '../../../../core/services/farmer';
import type { FarmerFarm } from '../../../../shared/farm.model';
import { ImageUpload } from '../../../../shared/image-upload/image-upload';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { finalize } from 'rxjs';

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
    RouterLink,
    ImageUpload,
  ],
  styleUrl: './add-product.scss',
  templateUrl: './add-product.html',
})
export class AddProduct implements OnInit {
  protected readonly productService = inject(Product);
  private readonly farmerService = inject(Farmer);
  private readonly router = inject(Router);
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
    dispatchFarm: [null as number | string | null, [Validators.required]],
    available: [true], // not part of the backend schema, kept for the UI only
  });

  /** Produce categories only: filter by category type 'FARMER'. */
  protected readonly categories = computed(() =>
    this.productService
      .categories()
      .filter((c) => c.type === 'FARMER'),
  );

  protected readonly units = ['kg', 'g', 'liters', 'pieces', 'bunches', 'crates'];
  protected readonly submitting = signal<boolean>(false);
  protected readonly selectedImages = signal<File[]>([]);
  protected readonly farmsLoading = signal(true);
  protected readonly farmsError = signal<string | null>(null);
  protected readonly activeFarms = signal<FarmerFarm[]>([]);

  protected get canSubmit(): boolean {
    return !this.submitting() && !this.farmsLoading() &&
      this.form.valid && this.selectedImages().length > 0;
  }

  ngOnInit(): void {
    if (this.productService.categories().length === 0) {
      this.productService.reloadCategories();
    }
    this.loadDispatchFarms();
  }

  protected loadDispatchFarms(): void {
    this.farmsLoading.set(true);
    this.farmsError.set(null);
    this.farmerService.getMyFarms()
      .pipe(finalize(() => this.farmsLoading.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success || !response.data) {
            this.farmsError.set(response.message || 'Could not load your farms.');
            return;
          }

          const farms = response.data.filter((farm) => farm.status?.toUpperCase() === 'ACTIVE');
          this.activeFarms.set(farms);
          if (farms.length === 1) {
            this.form.controls['dispatchFarm'].setValue(farms[0].id);
          }
        },
        error: (error: { error?: { message?: string } }) => {
          this.farmsError.set(error.error?.message || 'Could not load your farms. Try again.');
        },
      });
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

    if (this.activeFarms().length === 0) {
      this.notification.warning('Add an active farm before creating a product listing');
      return;
    }

    this.submitting.set(true);
    this.createProduct();
  }

  private createProduct(): void {
    const v = this.form.value;
    const selected = this.categories().find((c) => c.id === v.category);
    const farmId = Number(v.dispatchFarm);

    if (!selected) {
      this.submitting.set(false);
      this.notification.error('Please choose a valid category');
      return;
    }
    if (!Number.isSafeInteger(farmId) || farmId <= 0 ||
      !this.activeFarms().some((farm) => String(farm.id) === String(v.dispatchFarm))) {
      this.submitting.set(false);
      this.notification.error('Choose an active farm as your dispatch location.');
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
      farmId,
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
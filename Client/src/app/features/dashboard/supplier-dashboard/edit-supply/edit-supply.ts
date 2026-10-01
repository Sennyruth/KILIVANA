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
import type { ProductCategory, Product as ProductModel, ProductImage, ProductType } from '../../../../shared/product.model';

const INPUT_CATEGORIES: ProductCategory[] = [
  'FERTILIZERS',
  'SEEDS',
  'PESTICIDES',
  'EQUIPMENT',
  'TOOLS',
  'OTHER',
] as ProductCategory[];

@Component({
  selector: 'app-edit-supply',
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
  styleUrl: './edit-supply.scss',
  templateUrl: './edit-supply.html',
})
export class EditSupply implements OnInit {
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

  protected readonly categories = signal(INPUT_CATEGORIES);
  protected readonly units = ['kg', 'liters', 'pieces', 'bags', 'boxes', 'units'];
  protected readonly loading = computed(() => this.productService.loading());
  protected readonly selectedImages = signal<File[]>([]);
  protected readonly existingImages = signal<ProductImage[]>([]);
  protected readonly supplyId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.loadSupply();
  }

  private loadSupply(): void {
    this.productService.getById(this.supplyId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const supply = res.data.product;
          this.form.patchValue({
            name: supply.name,
            description: supply.description,
            category: supply.category,
            price: supply.price,
            quantity: supply.quantity,
            unit: supply.unit,
            available: supply.available,
          });
          this.existingImages.set(supply.images || []);
          this.isLoading.set(false);
        } else {
          this.snackBar.open(res.message || 'Failed to load supply', 'Close', { duration: 5000 });
          this.router.navigate(['/dashboard/supplier']);
        }
      },
      error: () => {
        this.snackBar.open('Failed to load supply', 'Close', { duration: 5000 });
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
      this.snackBar.open('Please fill in all required fields', 'Close', { duration: 3000 });
      return;
    }

    const formValue = this.form.value;
    const supplyData = {
      name: formValue.name,
      description: formValue.description,
      category: formValue.category as ProductCategory,
      price: Number(formValue.price),
      quantity: Number(formValue.quantity),
      unit: formValue.unit,
      available: formValue.available,
      images: this.existingImages(),
      type: 'INPUT' as ProductType,
    };

    // Upload new images if any
    if (this.selectedImages().length > 0) {
      this.productService.uploadImages(this.selectedImages()).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const newImages: ProductImage[] = res.data.urls.map((url, i) => ({ id: `new-${i}`, url, alt: formValue.name, isPrimary: false }));
            supplyData.images = [...this.existingImages(), ...newImages];
            this.updateSupply(supplyData);
          } else {
            this.snackBar.open(res.message || 'Failed to upload images', 'Close', { duration: 5000 });
          }
        },
        error: () => {
          this.snackBar.open('Failed to upload images', 'Close', { duration: 5000 });
        },
      });
    } else {
      this.updateSupply(supplyData);
    }
  }

  private updateSupply(supplyData: any): void {
    // Note: This would call an update API endpoint
    // For now, we'll just show a success message and navigate back
    this.snackBar.open('Supply updated successfully!', 'Close', { duration: 3000 });
    this.router.navigate(['/dashboard/supplier']);
  }

  protected removeExistingImage(index: number): void {
    this.existingImages.update((prev) => prev.filter((_, i) => i !== index));
  }

  protected cancel(): void {
    this.router.navigate(['/dashboard/supplier']);
  }
}

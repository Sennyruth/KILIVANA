import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Product } from './product';
import { API_BASE } from '../../shared/api.config';

describe('Product', () => {
  let service: Product;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Product);
    httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${API_BASE}/categories/active`).flush({
      success: true,
      message: 'Success',
      data: [],
    });
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads and normalizes the direct product response used by the backend', () => {
    let loadedProduct: { id: string; categoryId?: number; status?: string } | null | undefined;
    service.getById('39').subscribe((response) => {
      loadedProduct = response.data;
    });

    httpTesting.expectOne(`${API_BASE}/products/39`).flush({
      success: true,
      message: 'Success',
      data: {
        id: 39,
        sellerId: 8,
        sellerType: 'FARMER',
        categoryId: 3,
        name: 'Tomatoes',
        description: 'Fresh tomatoes',
        unit: 'kg',
        price: 120,
        stockQty: 10,
        reservedQty: 0,
        soldQty: 0,
        minimumOrderQty: 1,
        status: 'INACTIVE',
        createdAt: '2026-10-07T10:00:00',
        images: [],
      },
    });

    expect(loadedProduct).toMatchObject({
      id: '39',
      categoryId: 3,
      status: 'INACTIVE',
    });
  });

  it('loads active listings for the buyer catalogue', () => {
    service.loadAll().subscribe();
    httpTesting.expectOne(`${API_BASE}/products`).flush({
      success: true,
      message: 'Success',
      data: [
        {
          id: 51,
          sellerId: 3,
          sellerType: 'FARMER',
          categoryId: 21,
          name: 'Demo Fresh Tomatoes',
          description: 'Freshly harvested tomatoes from Nakuru.',
          unit: 'kg',
          price: 120,
          stockQty: 250,
          reservedQty: 0,
          soldQty: 0,
          minimumOrderQty: 1,
          status: 'ACTIVE',
          createdAt: '2026-10-07T10:00:00',
          images: [],
        },
        {
          id: 52,
          sellerId: 5,
          sellerType: 'SUPPLIER',
          categoryId: 22,
          name: 'Demo NPK Fertilizer',
          description: 'Balanced fertilizer for healthy crop growth.',
          unit: 'bag',
          price: 3200,
          stockQty: 45,
          reservedQty: 0,
          soldQty: 0,
          minimumOrderQty: 1,
          status: 'ACTIVE',
          createdAt: '2026-10-07T10:00:00',
          images: [],
        },
      ],
    });

    httpTesting.expectOne(`${API_BASE}/products/51/images`).flush({
      success: true,
      message: 'Success',
      data: [],
    });
    httpTesting.expectOne(`${API_BASE}/products/52/images`).flush({
      success: true,
      message: 'Success',
      data: [],
    });

    expect(service.products().map(({ name, type, available }) => ({ name, type, available }))).toEqual([
      { name: 'Demo Fresh Tomatoes', type: 'PRODUCE', available: true },
      { name: 'Demo NPK Fertilizer', type: 'INPUT', available: true },
    ]);
  });

  it('loads only active farmer products for a farmer profile', () => {
    let farmerProducts: { id: string; name: string }[] = [];
    service.loadFarmerProducts('3').subscribe((response) => {
      farmerProducts = response.data;
    });

    httpTesting.expectOne(`${API_BASE}/products/seller/3`).flush({
      success: true,
      message: 'Success',
      data: [
        {
          id: 61,
          sellerId: 3,
          sellerType: 'FARMER',
          categoryId: 1,
          name: 'Fresh Beans',
          description: 'Beans from the farm',
          unit: 'kg',
          price: 90,
          stockQty: 12,
          reservedQty: 0,
          soldQty: 0,
          minimumOrderQty: 1,
          status: 'ACTIVE',
          createdAt: '2026-10-07T10:00:00',
          images: [],
        },
        {
          id: 62,
          sellerId: 3,
          sellerType: 'FARMER',
          categoryId: 1,
          name: 'Pending Beans',
          description: 'Not for sale yet',
          unit: 'kg',
          price: 90,
          stockQty: 12,
          reservedQty: 0,
          soldQty: 0,
          minimumOrderQty: 1,
          status: 'PENDING_APPROVAL',
          createdAt: '2026-10-07T10:00:00',
          images: [],
        },
        {
          id: 63,
          sellerId: 3,
          sellerType: 'SUPPLIER',
          categoryId: 1,
          name: 'Fertilizer',
          description: 'Farm input',
          unit: 'bag',
          price: 90,
          stockQty: 12,
          reservedQty: 0,
          soldQty: 0,
          minimumOrderQty: 1,
          status: 'ACTIVE',
          createdAt: '2026-10-07T10:00:00',
          images: [],
        },
      ],
    });
    httpTesting.expectOne(`${API_BASE}/products/61/images`).flush({
      success: true,
      message: 'Success',
      data: [],
    });

    expect(farmerProducts).toEqual([
      expect.objectContaining({ id: '61', name: 'Fresh Beans' }),
    ]);
  });

  it('loads seller-owned supplier listings and uses backend category types', () => {
    service.reloadCategories();
    httpTesting.expectOne(`${API_BASE}/categories/active`).flush({
      success: true,
      message: 'Success',
      data: [
        { id: 13, name: 'Farm Inputs', type: 'SUPPLIER', active: true },
        { id: 3, name: 'Vegetables', type: 'FARMER', active: true },
      ],
    });

    service.loadSellerProducts().subscribe();
    httpTesting.expectOne(`${API_BASE}/auth/me`).flush({
      success: true,
      message: 'Success',
      data: { id: 8 },
    });

    httpTesting.expectOne(`${API_BASE}/products/seller/8`).flush({
      success: true,
      message: 'Success',
      data: [
        {
          id: 40,
          sellerId: 8,
          sellerType: 'SUPPLIER',
          categoryId: 13,
          name: 'Dudu Dust',
          description: 'Effective for killing pests',
          unit: 'pieces',
          price: 12,
          stockQty: 10,
          reservedQty: 0,
          soldQty: 0,
          minimumOrderQty: 1,
          status: 'ACTIVE',
          createdAt: '2026-10-07T10:00:00',
          images: [
            {
              id: 3,
              url: '/api/v1/images/32',
              publicId: 'dudu-dust',
              assetId: null,
              sortOrder: 0,
              isPrimary: true,
              createdAt: '2026-10-07T10:00:00',
            },
          ],
        },
      ],
    });

    expect(service.products()).toHaveLength(1);
    expect(service.products()[0]).toMatchObject({
      id: '40',
      category: 'FARM INPUTS',
      type: 'INPUT',
      location: '',
      available: true,
      images: [
        { id: 3, url: `${new URL(API_BASE).origin}/api/v1/images/32`, isPrimary: true },
      ],
    });
    expect(service.categories()).toEqual([
      { id: 13, name: 'Farm Inputs', type: 'SUPPLIER' },
      { id: 3, name: 'Vegetables', type: 'FARMER' },
    ]);
  });

  it('resolves the current seller again instead of reusing a previous account id', () => {
    service.loadSellerProducts().subscribe();
    httpTesting.expectOne(`${API_BASE}/auth/me`).flush({
      success: true,
      message: 'Success',
      data: { id: 8 },
    });
    httpTesting.expectOne(`${API_BASE}/products/seller/8`).flush({
      success: true,
      message: 'Success',
      data: [],
    });

    service.loadSellerProducts().subscribe();
    httpTesting.expectOne(`${API_BASE}/auth/me`).flush({
      success: true,
      message: 'Success',
      data: { id: 9 },
    });
    httpTesting.expectOne(`${API_BASE}/products/seller/9`).flush({
      success: true,
      message: 'Success',
      data: [],
    });

    expect(service.products()).toEqual([]);
  });

  it('hides and reports listings returned for a different seller id', () => {
    let failureMessage = '';
    service.loadSellerProducts().subscribe({
      error: (error: Error) => {
        failureMessage = error.message;
      },
    });
    httpTesting.expectOne(`${API_BASE}/auth/me`).flush({
      success: true,
      message: 'Success',
      data: { id: 8 },
    });
    httpTesting.expectOne(`${API_BASE}/products/seller/8`).flush({
      success: true,
      message: 'Success',
      data: [
        {
          id: 45,
          sellerId: 8,
          sellerType: 'SUPPLIER',
          categoryId: 13,
          name: 'My input',
          description: 'A listing owned by this account.',
          unit: 'bag',
          price: 10,
          stockQty: 5,
          reservedQty: 0,
          soldQty: 0,
          minimumOrderQty: 1,
          status: 'PENDING_APPROVAL',
          createdAt: '2026-10-07T10:00:00',
          images: [],
        },
        {
          id: 46,
          sellerId: 9,
          sellerType: 'SUPPLIER',
          categoryId: 13,
          name: 'Another seller input',
          description: 'This listing belongs to a different account.',
          unit: 'bag',
          price: 10,
          stockQty: 5,
          reservedQty: 0,
          soldQty: 0,
          minimumOrderQty: 1,
          status: 'PENDING_APPROVAL',
          createdAt: '2026-10-07T10:00:00',
          images: [],
        },
      ],
    });
    httpTesting.expectOne(`${API_BASE}/products/45/images`).flush({
      success: true,
      message: 'Success',
      data: [],
    });

    expect(service.products().map((product) => product.name)).toEqual(['My input']);
    expect(failureMessage).toContain('listings owned by another seller');
  });

  it('sends product updates in the backend request shape', () => {
    service.getById('39').subscribe();
    httpTesting.expectOne(`${API_BASE}/products/39`).flush({
      success: true,
      message: 'Success',
      data: {
        id: 39,
        sellerId: 8,
        sellerType: 'FARMER',
        categoryId: 3,
        name: 'Tomatoes',
        description: 'Fresh tomatoes',
        unit: 'kg',
        price: 120,
        stockQty: 10,
        reservedQty: 0,
        soldQty: 0,
        minimumOrderQty: 1,
        status: 'INACTIVE',
        createdAt: '2026-10-07T10:00:00',
        images: [],
      },
    });

    service.update('39', {
      name: 'Ripe tomatoes',
      description: 'Fresh ripe tomatoes',
      price: 150,
      quantity: 12,
      unit: 'kg',
      categoryId: 4,
      minimumOrderQty: 2,
    }).subscribe();

    const request = httpTesting.expectOne(`${API_BASE}/products/39`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      sellerId: 8,
      sellerType: 'FARMER',
      categoryId: 4,
      name: 'Ripe tomatoes',
      description: 'Fresh ripe tomatoes',
      unit: 'kg',
      price: 150,
      stockQty: 12,
      minimumOrderQty: 2,
    });
    request.flush({
      success: true,
      message: 'Updated',
      data: {
        id: 39,
        sellerId: 8,
        sellerType: 'FARMER',
        categoryId: 4,
        name: 'Ripe tomatoes',
        description: 'Fresh ripe tomatoes',
        unit: 'kg',
        price: 150,
        stockQty: 12,
        reservedQty: 0,
        soldQty: 0,
        minimumOrderQty: 2,
        status: 'INACTIVE',
        createdAt: '2026-10-07T10:00:00',
        images: [],
      },
    });
  });

  it('sends availability status as the API query parameter', () => {
    service.updateStatus('39', 'ACTIVE').subscribe();
    const request = httpTesting.expectOne(`${API_BASE}/products/39/status?status=ACTIVE`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({});
    request.flush({ success: true, message: 'Updated', data: {} });
  });

  it('creates a listing first, then uploads images through the documented image endpoint', () => {
    const image = new File(['image contents'], 'tomatoes.jpg', { type: 'image/jpeg' });
    let createdWithImage: { id: number; images?: { url: string }[] | null } | undefined;
    service.createListingWithImages('farmer', {
      categoryId: 13,
      name: 'Tomatoes',
      description: 'Fresh tomatoes from the farm',
      unit: 'kg',
      price: 120,
      stockQty: 10,
      minimumOrderQty: 1,
    }, [image]).subscribe((response) => {
      createdWithImage = response.data;
    });

    httpTesting.expectOne(`${API_BASE}/auth/me`).flush({
      success: true,
      message: 'Success',
      data: { id: 8 },
    });

    const createRequest = httpTesting.expectOne(`${API_BASE}/products`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({
      sellerId: 8,
      sellerType: 'FARMER',
      categoryId: 13,
      name: 'Tomatoes',
      description: 'Fresh tomatoes from the farm',
      unit: 'kg',
      price: 120,
      stockQty: 10,
      minimumOrderQty: 1,
    });
    createRequest.flush({
      success: true,
      message: 'Created',
      data: { id: 40, images: [] },
    });

    const uploadRequest = httpTesting.expectOne(
      `${API_BASE}/products/40/images?sortOrder=0&isPrimary=true`,
    );
    expect(uploadRequest.request.method).toBe('POST');
    expect((uploadRequest.request.body as FormData).get('image')).toBe(image);
    expect((uploadRequest.request.body as FormData).get('images')).toBeNull();
    uploadRequest.flush({
      success: true,
      message: 'Uploaded',
      data: { id: 3, url: '/api/v1/images/32', isPrimary: true },
    });

    expect(createdWithImage?.images).toEqual([
      { id: 3, url: `${new URL(API_BASE).origin}/api/v1/images/32`, isPrimary: true },
    ]);
  });

  it('uploads each image using the single-image API field and marks the first image primary', () => {
    const files = [new File(['first'], 'first.jpg'), new File(['second'], 'second.jpg')];
    let succeeded = false;
    let uploadedCount = 0;

    service.uploadImages(39, files).subscribe((response) => {
      succeeded = response.success;
      uploadedCount = response.data.length;
    });

    const firstRequest = httpTesting.expectOne(
      `${API_BASE}/products/39/images?sortOrder=0&isPrimary=true`,
    );

    expect(firstRequest.request.method).toBe('POST');
    expect((firstRequest.request.body as FormData).get('image')).toBe(files[0]);
    expect((firstRequest.request.body as FormData).get('images')).toBeNull();

    firstRequest.flush({
      success: true,
      message: 'Success',
      data: { id: 1, url: 'https://images.example/first.jpg', isPrimary: true },
    });

    const secondRequest = httpTesting.expectOne(
      `${API_BASE}/products/39/images?sortOrder=1&isPrimary=false`,
    );
    expect((secondRequest.request.body as FormData).get('image')).toBe(files[1]);
    secondRequest.flush({
      success: true,
      message: 'Success',
      data: { id: 2, url: 'https://images.example/second.jpg', isPrimary: false },
    });

    expect(succeeded).toBe(true);
    expect(uploadedCount).toBe(2);
  });

  it('does not report a successful upload when the backend returns an empty image URL', () => {
    let uploadResponse: { success: boolean; message: string } | undefined;
    service.uploadImages(39, [new File(['image'], 'image.jpg')]).subscribe((response) => {
      uploadResponse = response;
    });

    httpTesting.expectOne(
      `${API_BASE}/products/39/images?sortOrder=0&isPrimary=true`,
    ).flush({
      success: true,
      message: 'Uploaded',
      data: { id: 1, url: '', isPrimary: true },
    });

    expect(uploadResponse?.success).toBe(false);
    expect(uploadResponse?.message).toContain('no usable image URL');
  });
});

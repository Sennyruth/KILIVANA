import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Checkout, pickupDistanceKm } from './checkout';

describe('Checkout', () => {
  let component: Checkout;
  let fixture: ComponentFixture<Checkout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Checkout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calculates the distance between pickup points and a customer location', () => {
    expect(pickupDistanceKm(
      { latitude: -1.2864, longitude: 36.8172 },
      { latitude: -1.2921, longitude: 36.8219 },
    )).toBeCloseTo(0.8, 1);
  });

  it('rejects invalid coordinates when calculating pickup distances', () => {
    expect(pickupDistanceKm(
      { latitude: 91, longitude: 36.8172 },
      { latitude: -1.2921, longitude: 36.8219 },
    )).toBeNull();
  });
});

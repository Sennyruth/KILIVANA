import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartView } from './cart-view';

describe('CartView', () => {
  let component: CartView;
  let fixture: ComponentFixture<CartView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartView],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CartView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

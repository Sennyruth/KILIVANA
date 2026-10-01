import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BuyerDashboard } from './buyer-dashboard';

describe('BuyerDashboard', () => {
  let component: BuyerDashboard;
  let fixture: ComponentFixture<BuyerDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuyerDashboard],
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

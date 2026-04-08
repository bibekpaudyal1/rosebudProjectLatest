import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn
} from 'typeorm';

@Entity('phone_otp')
export class PhoneOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ name: 'otp_hash' })
  otpHash: string;

  @Column({ length: 50 })
  purpose: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'verified_at', nullable: true })
  verifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

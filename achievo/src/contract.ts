
import { NearBindgen, near, call, view, LookupMap, Vector } from 'near-sdk-js';

// Định nghĩa các struct và enum
export interface Individual {
  id: string;
  name: string;
  dob: string;
  email: string;
  registered_at: string;
}

export interface Organization {
  id: string;
  name: string;
  contact_info: string;
  verified: boolean;
  registered_at: string;
}

export interface CertificateMetadata {
  learner_id: string;
  course_id: string;
  course_name: string;
  completion_date: string;
  issuer_org_id: string;
  skills: string[];
  grade?: string;
}

export interface Certificate {
  id: string;
  metadata: CertificateMetadata;
  status: string; // "pending", "completed", "revoked"
  issued_at: string;
  updated_at: string;
}

export interface Reward {
  id: string;
  learner_id: string;
  milestone: string;
  amount: string;
  granted_at: string;
}

export interface UpdateLog {
  timestamp: string;
  action: string;
  reason: string;
  by_account: string;
}

@NearBindgen({})
export class AchievoContract {
  // Storage collections
  individuals: LookupMap<Individual>;
  organizations: LookupMap<Organization>;
  certificates: LookupMap<Certificate>;
  rewards: LookupMap<Reward>;
  certificate_history: LookupMap<UpdateLog[]>;
  
  // Counters for generating IDs
  certificate_counter: number = 0;
  reward_counter: number = 0;

  constructor() {
    this.individuals = new LookupMap('individuals');
    this.organizations = new LookupMap('organizations');
    this.certificates = new LookupMap('certificates');
    this.rewards = new LookupMap('rewards');
    this.certificate_history = new LookupMap('cert_history');
  }

  // 1. Quản lý người dùng - Đăng ký cá nhân
  @call({})
  register_individual({ name, dob, email }: { name: string; dob: string; email: string }): void {
    const caller = near.predecessorAccountId();
    
    // Kiểm tra xem người dùng đã đăng ký chưa
    if (this.individuals.get(caller)) {
      throw new Error("Individual already registered");
    }

    const individual: Individual = {
      id: caller,
      name,
      dob,
      email,
      registered_at: new Date().toISOString()
    };

    this.individuals.set(caller, individual);
    near.log(`Individual registered: ${caller} - ${name}`);
  }

  // 2. Đăng ký tổ chức
  @call({})
  register_organization({ name, contact_info }: { name: string; contact_info: string }): void {
    const caller = near.predecessorAccountId();
    
    if (this.organizations.get(caller)) {
      throw new Error("Organization already registered");
    }

    const organization: Organization = {
      id: caller,
      name,
      contact_info,
      verified: false, // Chờ duyệt
      registered_at: new Date().toISOString()
    };

    this.organizations.set(caller, organization);
    near.log(`Organization registered: ${caller} - ${name} (pending verification)`);
  }

  // 3. Phê duyệt tổ chức (chỉ admin)
  @call({})
  verify_organization({ organization_id }: { organization_id: string }): void {
    // Trong production, cần implement role-based access control
    // Hiện tại giả định contract owner là admin
    
    const organization = this.organizations.get(organization_id);
    if (!organization) {
      throw new Error("Organization not found");
    }

    organization.verified = true;
    this.organizations.set(organization_id, organization);
    near.log(`Organization verified: ${organization_id}`);
  }

  // 4. Phát hành chứng chỉ
  @call({})
  issue_certificate({ learner_id, course_id, metadata }: { 
    learner_id: string; 
    course_id: string; 
    metadata: CertificateMetadata 
  }): string {
    const caller = near.predecessorAccountId();
    
    // Kiểm tra tổ chức đã được verify
    const organization = this.organizations.get(caller);
    if (!organization || !organization.verified) {
      throw new Error("Only verified organizations can issue certificates");
    }

    // Kiểm tra learner tồn tại
    if (!this.individuals.get(learner_id)) {
      throw new Error("Learner not found");
    }

    this.certificate_counter++;
    const certificate_id = `cert_${this.certificate_counter}`;

    const certificate: Certificate = {
      id: certificate_id,
      metadata: {
        ...metadata,
        learner_id,
        course_id,
        issuer_org_id: caller
      },
      status: "pending",
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.certificates.set(certificate_id, certificate);
    
    // Tạo log entry đầu tiên
    const initial_log: UpdateLog = {
      timestamp: new Date().toISOString(),
      action: "issued",
      reason: "Certificate issued",
      by_account: caller
    };
    this.certificate_history.set(certificate_id, [initial_log]);

    near.log(`Certificate issued: ${certificate_id} for ${learner_id}`);
    return certificate_id;
  }

  // 5. Cập nhật trạng thái chứng chỉ
  @call({})
  update_certificate_status({ certificate_id, new_status }: { 
    certificate_id: string; 
    new_status: string 
  }): void {
    const caller = near.predecessorAccountId();
    const certificate = this.certificates.get(certificate_id);
    
    if (!certificate) {
      throw new Error("Certificate not found");
    }

    // Kiểm tra quyền (chỉ tổ chức phát hành hoặc admin)
    if (certificate.metadata.issuer_org_id !== caller) {
      throw new Error("Unauthorized to update this certificate");
    }

    certificate.status = new_status;
    certificate.updated_at = new Date().toISOString();
    this.certificates.set(certificate_id, certificate);

    // Thêm log
    const history = this.certificate_history.get(certificate_id) || [];
    history.push({
      timestamp: new Date().toISOString(),
      action: "status_updated",
      reason: `Status changed to ${new_status}`,
      by_account: caller
    });
    this.certificate_history.set(certificate_id, history);

    near.log(`Certificate ${certificate_id} status updated to: ${new_status}`);
  }

  // 6. Thu hồi chứng chỉ
  @call({})
  revoke_certificate({ certificate_id, reason }: { 
    certificate_id: string; 
    reason: string 
  }): void {
    const caller = near.predecessorAccountId();
    const certificate = this.certificates.get(certificate_id);
    
    if (!certificate) {
      throw new Error("Certificate not found");
    }

    if (certificate.metadata.issuer_org_id !== caller) {
      throw new Error("Unauthorized to revoke this certificate");
    }

    certificate.status = "revoked";
    certificate.updated_at = new Date().toISOString();
    this.certificates.set(certificate_id, certificate);

    // Thêm log
    const history = this.certificate_history.get(certificate_id) || [];
    history.push({
      timestamp: new Date().toISOString(),
      action: "revoked",
      reason,
      by_account: caller
    });
    this.certificate_history.set(certificate_id, history);

    near.log(`Certificate ${certificate_id} revoked. Reason: ${reason}`);
  }

  // 7. Cấp phần thưởng
  @call({})
  grant_reward({ learner_id, milestone }: { 
    learner_id: string; 
    milestone: string 
  }): string {
    if (!this.individuals.get(learner_id)) {
      throw new Error("Learner not found");
    }

    this.reward_counter++;
    const reward_id = `reward_${this.reward_counter}`;

    const reward: Reward = {
      id: reward_id,
      learner_id,
      milestone,
      amount: "100", // Có thể customize
      granted_at: new Date().toISOString()
    };

    this.rewards.set(reward_id, reward);
    near.log(`Reward granted: ${reward_id} to ${learner_id} for ${milestone}`);
    return reward_id;
  }

  // 8. Liệt kê phần thưởng của học viên
  @view({})
  list_rewards({ learner_id }: { learner_id: string }): Reward[] {
    const rewards: Reward[] = [];
    
    // Iterate through all rewards to find those belonging to the learner
    // Note: In production, consider using a more efficient indexing system
    for (let i = 1; i <= this.reward_counter; i++) {
      const reward = this.rewards.get(`reward_${i}`);
      if (reward && reward.learner_id === learner_id) {
        rewards.push(reward);
      }
    }
    
    return rewards;
  }

  // 9. Xác thực chứng chỉ
  @view({})
  validate_certificate({ certificate_id }: { certificate_id: string }): CertificateMetadata | null {
    const certificate = this.certificates.get(certificate_id);
    
    if (!certificate) {
      return null;
    }

    if (certificate.status === "revoked") {
      throw new Error("Certificate has been revoked");
    }

    return certificate.metadata;
  }

  // 10. Lấy lịch sử chứng chỉ
  @view({})
  get_certificate_history({ certificate_id }: { certificate_id: string }): UpdateLog[] {
    const history = this.certificate_history.get(certificate_id);
    return history || [];
  }

  // 11. Xử lý thanh toán
  @call({ payableFunction: true })
  process_payment({ recipient_id, amount }: { 
    recipient_id: string; 
    amount: string 
  }): void {
    const sender = near.predecessorAccountId();
    const attached_deposit = near.attachedDeposit();
    const payment_amount = BigInt(amount);

    if (attached_deposit < payment_amount) {
      throw new Error("Insufficient attached deposit");
    }

    // Kiểm tra recipient tồn tại
    if (!this.individuals.get(recipient_id) && !this.organizations.get(recipient_id)) {
      throw new Error("Recipient not found");
    }

    // Transfer NEAR tokens
    const promise = near.promiseBatchCreate(recipient_id);
    near.promiseBatchActionTransfer(promise, payment_amount);
    near.promiseReturn(promise);

    near.log(`Payment processed: ${sender} -> ${recipient_id}, amount: ${amount}`);
  }

  // Utility view methods
  @view({})
  get_individual({ account_id }: { account_id: string }): Individual | null {
    return this.individuals.get(account_id);
  }

  @view({})
  get_organization({ account_id }: { account_id: string }): Organization | null {
    return this.organizations.get(account_id);
  }

  @view({})
  get_certificate({ certificate_id }: { certificate_id: string }): Certificate | null {
    return this.certificates.get(certificate_id);
  }
}

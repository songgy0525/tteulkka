package com.tteulkka.backend.store.loader;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "adm_dong")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AdmDong {

    @Id
    @Column(name = "code", length = 8)
    private String code;

    @Column(name = "sido", nullable = false)
    private String sido;

    @Column(name = "sigungu", nullable = false)
    private String sigungu;

    @Column(name = "dong", nullable = false)
    private String dong;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private LoadStatus status;

    @Column(name = "store_count")
    private Integer storeCount;

    @Column(name = "loaded_at")
    private LocalDateTime loadedAt;

    public static AdmDong of(String code, String sido, String sigungu, String dong) {
        AdmDong admDong = new AdmDong();
        admDong.code = code;
        admDong.sido = sido;
        admDong.sigungu = sigungu;
        admDong.dong = dong;
        admDong.status = LoadStatus.PENDING;
        return admDong;
    }

    public void markDone(int storeCount) {
        this.status = LoadStatus.DONE;
        this.storeCount = storeCount;
        this.loadedAt = LocalDateTime.now();
    }

    public void markFailed() {
        this.status = LoadStatus.FAILED;
        this.loadedAt = LocalDateTime.now();
    }

    public void resetToPending() {
        this.status = LoadStatus.PENDING;
        this.storeCount = null;
        this.loadedAt = null;
    }
}

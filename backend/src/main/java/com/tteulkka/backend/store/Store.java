package com.tteulkka.backend.store;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.locationtech.jts.geom.Point;

import java.time.LocalDateTime;

@Entity
@Table(name = "store")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Store {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String bizesId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String categoryCode;

    @Column(nullable = false)
    private String categoryName;

    @Column(columnDefinition = "GEOMETRY(Point, 4326)", nullable = false)
    private Point location;

    private String address;
    private String sido;
    private String sigungu;
    private String dong;

    @Column(nullable = false)
    private String status;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public static Store create(String bizesId, String name, String categoryCode, String categoryName,
                               Point location, String address, String sido, String sigungu, String dong) {
        Store store = new Store();
        store.bizesId = bizesId;
        store.name = name;
        store.categoryCode = categoryCode;
        store.categoryName = categoryName;
        store.location = location;
        store.address = address;
        store.sido = sido;
        store.sigungu = sigungu;
        store.dong = dong;
        store.status = "ACTIVE";
        return store;
    }
}

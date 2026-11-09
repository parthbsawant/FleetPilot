SET TIME ZONE 'Asia/Kolkata';

SELECT
    (SELECT COUNT(*) FROM vehicles) AS vehicles,
    (SELECT COUNT(*) FROM trips) AS trips,
    (SELECT COUNT(*) FROM maintenance) AS maintenance,
    (SELECT COUNT(*) FROM expenses) AS expenses;

SELECT status, COUNT(*) AS trips
FROM trips
GROUP BY status
ORDER BY status;

SELECT COUNT(*) AS completed_trips, SUM(distance_km) AS total_km
FROM trips
WHERE status = 'completed';

SELECT category, COUNT(*) AS entries, SUM(amount) AS total_inr
FROM expenses
GROUP BY category
ORDER BY total_inr DESC;

SELECT
    v.id,
    v.registration_number,
    v.status,
    GREATEST(
        v.initial_odometer_km,
        (SELECT MAX(t.end_odometer_km)
         FROM trips t
         WHERE t.vehicle_id = v.id AND t.status = 'completed'),
        (SELECT MAX(m.odometer_km)
         FROM maintenance m
         WHERE m.vehicle_id = v.id)
    ) AS current_odometer_km
FROM vehicles v
ORDER BY v.id;

INSERT INTO vehicles (registration_number, name_model, vehicle_type)
VALUES ('MH12FP0001', 'Copy of bus 1', 'bus');

INSERT INTO vehicles (registration_number, name_model, vehicle_type)
VALUES ('mh12 fp 9999', 'Messy plate', 'bus');

INSERT INTO vehicles (registration_number, name_model, vehicle_type)
VALUES ('MH12FP0099', 'Tipper', 'truck');

INSERT INTO trips (vehicle_id, status, origin, destination, start_at, end_at, start_odometer_km, end_odometer_km)
VALUES (4, 'completed', 'Pune', 'Satara', now() - INTERVAL '3 hours', now(), 60000, 59900);

INSERT INTO trips (vehicle_id, status, origin, destination, start_at, end_at, start_odometer_km)
VALUES (4, 'completed', 'Pune', 'Satara', now() - INTERVAL '3 hours', now(), 60000);

INSERT INTO trips (vehicle_id, status, origin, destination, start_at, start_odometer_km)
VALUES (1, 'in_progress', 'Pune', 'Nashik', now(), 70000);

INSERT INTO trips (vehicle_id, origin, destination, start_at)
VALUES (999, 'Pune', 'Nowhere', now());

INSERT INTO expenses (vehicle_id, expense_date, category, amount)
VALUES (1, CURRENT_DATE, 'fuel', 0);

INSERT INTO expenses (vehicle_id, expense_date, category, amount, maintenance_id)
VALUES (1, CURRENT_DATE, 'maintenance', 500, 1);

DELETE FROM vehicles WHERE id = 1;
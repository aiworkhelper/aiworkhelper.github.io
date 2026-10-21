"""
Параметрическая подставка для телефона -> STL для 3D-печати.

Модель строится как боковой профиль (линия заданной толщины со скруглёнными углами),
выдавленный на ширину подставки. Поменяйте параметры ниже и запустите:
    python stand.py
Получится файл phone-stand.stl (единицы - миллиметры).
"""
import math
import struct
import numpy as np

# ---------- ПАРАМЕТРЫ (мм, градусы) ----------
WIDTH = 70.0          # ширина подставки
THICK = 4.0           # толщина стенок
LIP_HEIGHT = 16.0     # высота передней губы, которая держит телефон
SEAT = 14.0           # ширина ложа под телефон (толщина телефона в чехле + запас)
ANGLE = 65.0          # наклон спинки от горизонта
BACK_LEN = 90.0       # длина спинки
FOOT_Y = 92.0         # где задняя опора касается стола (от передней кромки)
FILLET = 1.6          # радиус скругления углов профиля
ARC_STEPS = 6         # гладкость скруглений
OUT = "phone-stand.stl"


def centerline():
    """Средняя линия профиля в координатах (y - глубина, z - высота)."""
    h = THICK / 2
    c0 = (h, LIP_HEIGHT)                      # верх губы
    c1 = (h, h)                               # передний нижний угол
    c2 = (h + SEAT + THICK, h)                # начало спинки
    a = math.radians(ANGLE)
    c3 = (c2[0] + BACK_LEN * math.cos(a), c2[1] + BACK_LEN * math.sin(a))  # верх спинки
    c4 = (FOOT_Y, 0.0)                        # опора на стол
    return [np.array(p, float) for p in (c0, c1, c2, c3, c4)]


def line_intersect(p, d, q, e):
    """Точка пересечения прямых p + t*d и q + s*e."""
    m = np.array([d, -e]).T
    t, _ = np.linalg.solve(m, q - p)
    return p + t * d


def stroke(points, t):
    """Контур полосы толщиной t вдоль ломаной (стыки - по пересечению смещённых линий)."""
    h = t / 2
    dirs = [(b - a) / np.linalg.norm(b - a) for a, b in zip(points, points[1:])]
    normals = [np.array([-d[1], d[0]]) for d in dirs]   # нормаль влево по ходу

    def side(sign):
        out = []
        for i in range(len(points)):
            if i == 0:
                out.append(points[0] + sign * h * normals[0])
            elif i == len(points) - 1:
                # торец задней опоры срезаем горизонтально по столу (z = 0)
                p = points[i - 1] + sign * h * normals[i - 1]
                out.append(line_intersect(p, dirs[i - 1], np.array([0.0, 0.0]), np.array([1.0, 0.0])))
            else:
                p1 = points[i - 1] + sign * h * normals[i - 1]
                p2 = points[i] + sign * h * normals[i]
                out.append(line_intersect(p1, dirs[i - 1], p2, dirs[i]))
        return out

    left, right = side(+1), side(-1)
    poly = left + right[::-1]
    return [np.array(p) for p in poly]


def signed_area(poly):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1]))


def fillet(poly, r, steps):
    """Скругляет каждую вершину многоугольника дугой радиуса r (и выпуклые, и вогнутые)."""
    n = len(poly)
    out = []
    for i in range(n):
        a, p, b = poly[i - 1], poly[i], poly[(i + 1) % n]
        u = (a - p) / np.linalg.norm(a - p)
        v = (b - p) / np.linalg.norm(b - p)
        ang = math.acos(np.clip(np.dot(u, v), -1, 1))
        if ang > math.radians(178):
            out.append(p)
            continue
        rr = min(r, 0.45 * min(np.linalg.norm(a - p), np.linalg.norm(b - p)) * math.tan(ang / 2))
        d = rr / math.tan(ang / 2)
        t1, t2 = p + u * d, p + v * d
        bis = (u + v) / np.linalg.norm(u + v)
        center = p + bis * (rr / math.sin(ang / 2))
        a1 = math.atan2(*(t1 - center)[::-1])
        a2 = math.atan2(*(t2 - center)[::-1])
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi   # короткая дуга
        for k in range(steps + 1):
            th = a1 + da * k / steps
            out.append(center + rr * np.array([math.cos(th), math.sin(th)]))
    return out


def triangulate(poly):
    """Разбиение простого многоугольника (против часовой) на треугольники методом отсечения ушей."""
    idx = list(range(len(poly)))
    tris = []

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def inside(pt, a, b, c):
        return cross(a, b, pt) >= -1e-12 and cross(b, c, pt) >= -1e-12 and cross(c, a, pt) >= -1e-12

    guard = 0
    while len(idx) > 3 and guard < 100000:
        guard += 1
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = poly[i0], poly[i1], poly[i2]
            if cross(a, b, c) <= 1e-12:
                continue
            if any(inside(poly[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            idx.pop(k)
            break
        else:
            raise RuntimeError("не удалось триангулировать профиль")
    tris.append(tuple(idx))
    return tris


def dedupe(poly, eps=1e-6):
    out = []
    for p in poly:
        if not out or np.linalg.norm(p - out[-1]) > eps:
            out.append(p)
    if np.linalg.norm(out[0] - out[-1]) <= eps:
        out.pop()
    return out


def build():
    prof = stroke(centerline(), THICK)
    if signed_area(prof) < 0:
        prof = prof[::-1]
    prof = dedupe(fillet(prof, FILLET, ARC_STEPS))
    if signed_area(prof) < 0:
        prof = prof[::-1]
    n = len(prof)

    # вершины: x - ширина, y - глубина, z - высота
    verts = [(0.0, p[0], p[1]) for p in prof] + [(WIDTH, p[0], p[1]) for p in prof]
    faces = []
    for a, b, c in triangulate(prof):
        faces.append((a, c, b))                 # торец x = 0 смотрит в -x
        faces.append((a + n, b + n, c + n))     # торец x = WIDTH смотрит в +x
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, j + n))
        faces.append((i, j + n, i + n))
    return np.array(verts), np.array(faces)


def check(verts, faces):
    """Проверка, что сетка замкнута и ориентирована наружу (годится для печати)."""
    edges = {}
    for f in faces:
        for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
            edges[(a, b)] = edges.get((a, b), 0) + 1
    closed = all(edges.get((b, a), 0) == c == 1 for (a, b), c in edges.items())
    v = verts[faces]
    volume = np.einsum("ij,ij->i", v[:, 0], np.cross(v[:, 1], v[:, 2])).sum() / 6
    return closed, volume


def write_stl(path, verts, faces):
    with open(path, "wb") as f:
        f.write(b"phone stand - parametric demo".ljust(80, b" "))
        f.write(struct.pack("<I", len(faces)))
        for tri in faces:
            p = verts[tri]
            nrm = np.cross(p[1] - p[0], p[2] - p[0])
            nrm = nrm / (np.linalg.norm(nrm) or 1)
            f.write(struct.pack("<12fH", *nrm, *p[0], *p[1], *p[2], 0))


if __name__ == "__main__":
    verts, faces = build()
    closed, volume = check(verts, faces)
    mn, mx = verts.min(0), verts.max(0)
    print(f"треугольников: {len(faces)}, замкнута: {closed}, объём: {volume / 1000:.1f} см³")
    print(f"габариты (Ш x Г x В): {mx[0]-mn[0]:.1f} x {mx[1]-mn[1]:.1f} x {mx[2]-mn[2]:.1f} мм")
    print(f"PLA ~{volume / 1000 * 1.24:.0f} г при 100% заполнении")
    write_stl(OUT, verts, faces)
    print("сохранено:", OUT)

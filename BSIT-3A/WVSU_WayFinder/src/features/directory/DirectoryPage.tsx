import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { FacultyRow } from "../../components/FacultyCard";
import { SearchIcon } from "../../components/Icons";
import LoadError from "../../components/LoadError";
import Notice from "../../components/Notice";

import { listPlaces, searchFaculty } from "../../lib/data";
import { useAsync } from "../../lib/usePlaces";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "faculty", label: "Faculty" },
  { id: "building", label: "Buildings" },
  { id: "room", label: "Rooms" },
  { id: "office", label: "Offices" },
  { id: "college", label: "Colleges" },
  { id: "landmark", label: "Landmarks" },
] as const;

type Cat = (typeof CATEGORIES)[number]["id"];
type SortOrder = "az" | "za";

const PLACE_GROUPS = [
  { kind: "building", label: "Buildings", category: "building" },
  { kind: "room", label: "Rooms", category: "room" },
  { kind: "office", label: "Offices", category: "office" },
  { kind: "college", label: "Colleges", category: "college" },
  { kind: "landmark", label: "Campus landmarks", category: "landmark" },
] as const;

const PREVIEW_LIMIT = 3;

/** Unified directory with category previews and faculty filters. */
export default function DirectoryPage() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const q = params.get("q") ?? "";
  const requestedCat = params.get("cat");

  const cat: Cat = CATEGORIES.some(
    (item) => item.id === requestedCat
  )
    ? (requestedCat as Cat)
    : "all";

  const [value, setValue] = useState(q);
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("az");

  // Keep the search input synchronized with browser navigation.
  useEffect(() => {
    setValue(q);
  }, [q]);

  // Reset faculty filters when leaving the Faculty category.
  useEffect(() => {
    if (cat !== "faculty") {
      setSelectedCollege("");
      setSelectedPosition("");
      setSortOrder("az");
    }
  }, [cat]);

  // LAZY FETCHING:
  // Faculty is needed only in All and Faculty.
  // Campus locations are needed in All and place categories.
  const facultyEnabled = cat === "all" || cat === "faculty";
  const placesEnabled = cat !== "faculty";

  const faculty = useAsync(
    "fac:directory",
    () => searchFaculty(""),
    facultyEnabled
  );

  const places = useAsync(
    "list",
    listPlaces,
    placesEnabled
  );

  // ONE CENTRALIZED LOADING INDICATOR.
  const loadingMessage =
    cat === "all" &&
    (faculty.state === "loading" || places.state === "loading")
      ? "Loading directory…"
      : cat === "faculty" && faculty.state === "loading"
        ? "Loading faculty profiles…"
        : cat !== "all" &&
            cat !== "faculty" &&
            places.state === "loading"
          ? `Loading ${
              CATEGORIES.find((item) => item.id === cat)?.label.toLowerCase() ??
              "campus locations"
            }…`
          : null;

  const detailOpen =
    pathname !== "/directory" &&
    pathname !== "/directory/";

  const needle = q.trim().toLowerCase();
  const isAllOverview = cat === "all" && !needle;

  // Update URL while preserving the current search and category.
  const go = (next: { q?: string; cat?: Cat }) => {
    const nextQuery = next.q ?? q;
    const nextCategory = next.cat ?? cat;

    const p = new URLSearchParams();

    if (nextQuery) p.set("q", nextQuery);
    if (nextCategory !== "all") p.set("cat", nextCategory);

    navigate(`/directory${p.size ? `?${p.toString()}` : ""}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go({ q: value.trim() });
  };

  // FACULTY DATA
  const allFaculty =
    faculty.state === "done"
      ? faculty.result.data
      : [];

  // Generate filter options from verified faculty records.
  const collegeOptions = useMemo(
    () =>
      [
        ...new Set(
          allFaculty
            .map((f) => f.collegeUnit?.trim())
            .filter((v): v is string => Boolean(v))
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [allFaculty]
  );

  const positionOptions = useMemo(
    () =>
      [
        ...new Set(
          allFaculty
            .map((f) => f.positionTitle?.trim())
            .filter((v): v is string => Boolean(v))
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [allFaculty]
  );

  // Search across faculty name, email, position, department and college.
  const filteredFaculty = useMemo(() => {
    const result = allFaculty.filter((f) => {
      const searchableFields = [
        f.fullName,
        f.officialEmail,
        f.positionTitle,
        f.department,
        f.collegeUnit,
        f.collegeCode,
      ];

      const matchesSearch =
        !needle ||
        searchableFields.some((field) =>
          field?.toLowerCase().includes(needle)
        );

      const matchesCollege =
        cat !== "faculty" ||
        !selectedCollege ||
        f.collegeUnit === selectedCollege;

      const matchesPosition =
        cat !== "faculty" ||
        !selectedPosition ||
        f.positionTitle === selectedPosition;

      return (
        matchesSearch &&
        matchesCollege &&
        matchesPosition
      );
    });

    return result.sort((a, b) => {
      const comparison = a.fullName.localeCompare(
        b.fullName,
        undefined,
        { sensitivity: "base" }
      );

      return sortOrder === "az"
        ? comparison
        : -comparison;
    });
  }, [
    allFaculty,
    needle,
    cat,
    selectedCollege,
    selectedPosition,
    sortOrder,
  ]);

  // CAMPUS LOCATION DATA
  const placeRows =
    places.state === "done"
      ? places.result.data.filter(({ place, parent }) => {
          const matchesCategory =
            cat === "all" || place.kind === cat;

          const searchableText = [
            place.name,
            place.roomCode,
            place.shortName,
            parent?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return (
            matchesCategory &&
            (!needle || searchableText.includes(needle))
          );
        })
      : [];

  // Group campus locations for the All overview.
  const placeGroups = PLACE_GROUPS.map((group) => ({
    ...group,
    rows: placeRows.filter(
      ({ place }) => place.kind === group.kind
    ),
  })).filter((group) => group.rows.length > 0);

  const filtersActive =
    Boolean(selectedCollege || selectedPosition) ||
    sortOrder !== "az";

  const clearFilters = () => {
    setSelectedCollege("");
    setSelectedPosition("");
    setSortOrder("az");
  };

  const directoryHref = (targetCat: Cat) => {
    const p = new URLSearchParams();

    if (q) p.set("q", q);
    if (targetCat !== "all") p.set("cat", targetCat);

    return `/directory${p.size ? `?${p.toString()}` : ""}`;
  };

  const qs = params.toString()
    ? `?${params.toString()}`
    : "";

  const noAllResults =
    cat === "all" &&
    Boolean(needle) &&
    faculty.state === "done" &&
    places.state === "done" &&
    filteredFaculty.length === 0 &&
    placeRows.length === 0;

  const noOverviewData =
    isAllOverview &&
    faculty.state === "done" &&
    places.state === "done" &&
    allFaculty.length === 0 &&
    placeRows.length === 0;

  const showFacultySection =
    cat === "all" &&
    (isAllOverview
      ? allFaculty.length > 0
      : filteredFaculty.length > 0);

  const facultyDisplay = isAllOverview
    ? filteredFaculty.slice(0, PREVIEW_LIMIT)
    : filteredFaculty;

  return (
    <section
      className={`directory${detailOpen ? " detail-open" : ""}`}
    >
      <div className="dir-list">
        <h1 className="page-title">Directory</h1>

        <p className="muted">
          Teachers, buildings, rooms and offices.
        </p>

        {/* EXISTING GLOBAL SEARCH BAR */}
        <form
          className="searchbar"
          role="search"
          onSubmit={submit}
        >
          <SearchIcon />

          <input
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search teachers, rooms, offices"
            aria-label="Search the directory"
            enterKeyHint="search"
          />
        </form>

        {/* CATEGORY NAVIGATION */}
        <div
          className="chips"
          role="tablist"
          aria-label="Categories"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              className={`chip${cat === c.id ? " on" : ""}`}
              onClick={() => go({ cat: c.id })}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* SINGLE LOADING INDICATOR */}
        {loadingMessage && (
          <p
            className="muted directory-loading"
            role="status"
            aria-live="polite"
          >
            {loadingMessage}
          </p>
        )}

        {/* FACULTY-ONLY FILTER PANEL */}
        {cat === "faculty" && faculty.state === "done" && (
          <div className="directory-filter-panel">
            <div className="directory-filter-heading">
              <div>
                <h3>Filter Faculty</h3>
                <p className="muted small">
                  Narrow down your faculty search.
                </p>
              </div>

              {filtersActive && (
                <button
                  type="button"
                  className="directory-clear"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="directory-filter-grid">
              <label className="directory-filter-field">
                <span>College</span>

                <select
                  className="directory-filter"
                  value={selectedCollege}
                  onChange={(e) =>
                    setSelectedCollege(e.target.value)
                  }
                >
                  <option value="">All colleges</option>

                  {collegeOptions.map((college) => (
                    <option key={college} value={college}>
                      {college}
                    </option>
                  ))}
                </select>
              </label>

              <label className="directory-filter-field">
                <span>Position</span>

                <select
                  className="directory-filter"
                  value={selectedPosition}
                  onChange={(e) =>
                    setSelectedPosition(e.target.value)
                  }
                >
                  <option value="">All positions</option>

                  {positionOptions.map((position) => (
                    <option key={position} value={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </label>

              <label className="directory-filter-field">
                <span>Sort by</span>

                <select
                  className="directory-filter"
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(
                      e.target.value as SortOrder
                    )
                  }
                >
                  <option value="az">Name: A–Z</option>
                  <option value="za">Name: Z–A</option>
                </select>
              </label>
            </div>

            <p
              className="directory-result-count"
              aria-live="polite"
            >
              Showing{" "}
              <strong>{filteredFaculty.length}</strong> of{" "}
              <strong>{allFaculty.length}</strong> faculty members
            </p>
          </div>
        )}

        {/* ALL CATEGORY: OVERVIEW AND CROSS-CATEGORY SEARCH */}
        {cat === "all" && (
          <>
            {faculty.state === "error" && (
              <LoadError
                what="faculty profiles"
                onRetry={faculty.reload}
              />
            )}

            {faculty.state === "done" && (
              <>
                {faculty.result.notice && (
                  <Notice>{faculty.result.notice}</Notice>
                )}

                {showFacultySection && (
                  <section className="directory-group">
                    <div className="directory-section-heading">
                      <h2 className="section-label">Faculty</h2>

                      <Link
                        className="directory-view-all"
                        to={directoryHref("faculty")}
                      >
                        View all →
                      </Link>
                    </div>

                    {isAllOverview && (
                      <p className="muted small">
                        {allFaculty.length} faculty members
                      </p>
                    )}

                    {facultyDisplay.map((f) => (
                      <FacultyRow
                        key={f.id}
                        faculty={f}
                        to={`/directory/faculty/${encodeURIComponent(f.id)}${qs}`}
                        active={
                          pathname === `/directory/faculty/${f.id}`
                        }
                      />
                    ))}
                  </section>
                )}
              </>
            )}

            {places.state === "error" && (
              <LoadError
                what="campus locations"
                onRetry={places.reload}
              />
            )}

            {places.state === "done" && (
              <>
                {placeGroups.map((group) => {
                  const displayRows = isAllOverview
                    ? group.rows.slice(0, PREVIEW_LIMIT)
                    : group.rows;

                  return (
                    <section
                      className="directory-group"
                      key={group.kind}
                    >
                      <div className="directory-section-heading">
                        <h2 className="section-label">
                          {group.label}
                        </h2>

                        <Link
                          className="directory-view-all"
                          to={directoryHref(group.category)}
                        >
                          View all →
                        </Link>
                      </div>

                      {displayRows.map(({ place, parent }) => (
                        <Link
                          key={place.id}
                          to={`/directory/${place.id}${qs}`}
                          className={`card dir-row${
                            pathname === `/directory/${place.id}`
                              ? " active"
                              : ""
                          }`}
                        >
                          <span className="kind">
                            {place.kind}
                            {place.roomCode
                              ? ` · ${place.roomCode}`
                              : ""}
                          </span>

                          <span className="place-name">
                            {place.name}
                          </span>

                          {parent && (
                            <span className="muted small">
                              {parent.name}
                            </span>
                          )}
                        </Link>
                      ))}
                    </section>
                  );
                })}
              </>
            )}

            {noAllResults && (
              <div className="card empty" role="status">
                <h2>No directory results found.</h2>
                <p className="muted">
                  Try another name, email, room code, or location.
                </p>
              </div>
            )}

            {noOverviewData && (
              <div className="card empty" role="status">
                <h2>No verified directory records yet.</h2>
              </div>
            )}
          </>
        )}

        {/* FACULTY CATEGORY: COMPLETE FILTERABLE LIST */}
        {cat === "faculty" && (
          <>
            <div className="directory-section-heading">
              <h2 className="section-label">Faculty</h2>
            </div>

            {faculty.state === "error" && (
              <LoadError
                what="faculty profiles"
                onRetry={faculty.reload}
              />
            )}

            {faculty.state === "done" && (
              <>
                {faculty.result.notice && (
                  <Notice>{faculty.result.notice}</Notice>
                )}

                {allFaculty.length === 0 ? (
                  <div className="card empty" role="status">
                    <h2>No verified faculty profiles yet.</h2>
                  </div>
                ) : filteredFaculty.length === 0 ? (
                  <div className="card empty" role="status">
                    <h2>No matching faculty found.</h2>

                    <p className="muted">
                      Try another search term or adjust your filters.
                    </p>

                    {filtersActive && (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  filteredFaculty.map((f) => (
                    <FacultyRow
                      key={f.id}
                      faculty={f}
                      to={`/directory/faculty/${encodeURIComponent(f.id)}${qs}`}
                      active={
                        pathname === `/directory/faculty/${f.id}`
                      }
                    />
                  ))
                )}
              </>
            )}
          </>
        )}

        {/* INDIVIDUAL PLACE CATEGORIES */}
        {cat !== "all" && cat !== "faculty" && (
          <>
            <h2 className="section-label">
              {CATEGORIES.find((c) => c.id === cat)?.label}
            </h2>

            {places.state === "error" && (
              <LoadError
                what="campus locations"
                onRetry={places.reload}
              />
            )}

            {places.state === "done" && (
              <>
                {places.result.notice && (
                  <Notice>{places.result.notice}</Notice>
                )}

                {placeRows.length === 0 && (
                  <div className="card empty" role="status">
                    <h2>
                      {q
                        ? `No matching ${cat} found.`
                        : `No verified ${cat} records yet.`}
                    </h2>

                    <p className="muted">
                      Try another search term.
                    </p>
                  </div>
                )}

                {placeRows.map(({ place, parent }) => (
                  <Link
                    key={place.id}
                    to={`/directory/${place.id}${qs}`}
                    className={`card dir-row${
                      pathname === `/directory/${place.id}`
                        ? " active"
                        : ""
                    }`}
                  >
                    <span className="kind">
                      {place.kind}
                      {place.roomCode
                        ? ` · ${place.roomCode}`
                        : ""}
                    </span>

                    <span className="place-name">
                      {place.name}
                    </span>

                    {parent && (
                      <span className="muted small">
                        {parent.name}
                      </span>
                    )}
                  </Link>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* RIGHT-SIDE DETAILS PANEL */}
      <div className="dir-detail">
        {detailOpen ? (
          <Outlet />
        ) : (
          <div className="card empty desktop-only">
            <h2>Select a teacher or place</h2>
            <p className="muted">Details appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
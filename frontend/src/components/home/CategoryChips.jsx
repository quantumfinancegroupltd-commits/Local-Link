import { Link } from 'react-router-dom'

function Chip({ to, label, imageUrl }) {
  return (
    <Link to={to} className="group/chip">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:bg-slate-50">
        <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-100">
          {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        </div>
        <div className="whitespace-nowrap text-sm font-semibold text-slate-800">{label}</div>
      </div>
    </Link>
  )
}

export function CategoryChips({ images }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip
        to="/register?role=buyer&intent=produce&q=tomatoes"
        label="Tomatoes"
        imageUrl={images?.tomatoes}
      />
      <Chip
        to="/register?role=buyer&intent=produce&q=plantain"
        label="Plantain"
        imageUrl={images?.plantain}
      />
      <Chip
        to="/register?role=buyer&intent=produce&q=vegetables"
        label="Vegetables"
        imageUrl={images?.produce}
      />
      <Chip
        to="/register?role=buyer&intent=fix&q=electrician"
        label="Electrician"
        imageUrl={images?.fix}
      />
      <Chip
        to="/register?role=buyer&intent=fix&q=plumber"
        label="Plumber"
        imageUrl={images?.plumber}
      />
      <Chip
        to="/register?role=buyer&intent=fix&q=carpenter"
        label="Carpenter"
        imageUrl={images?.carpenter}
      />
      <Chip
        to="/register?role=buyer&intent=project&q=project"
        label="Run a project"
        imageUrl={images?.project}
      />
      <Chip
        to="/register?role=buyer&intent=supply&q=weekly"
        label="Weekly supply"
        imageUrl={images?.supply}
      />
    </div>
  )
}



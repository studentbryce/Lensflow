import { useEffect, useState } from "react";
import { BiUser } from "react-icons/bi";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import brandLogo from "../assets/images/Lensflow_brand_logo-transparent.png";

function Header() {
	const { profile } = useAuth();
	const [isCompact, setIsCompact] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(max-width: 650px)");
		const updateCompactState = () => setIsCompact(mediaQuery.matches);

		updateCompactState();
		mediaQuery.addEventListener("change", updateCompactState);

		return () => mediaQuery.removeEventListener("change", updateCompactState);
	}, []);

	const roleLabel = profile?.role === "photographer"
		? "Photographer"
		: "Client";

	return (
		<header className="top-header">
			<span className="top-header-brand">
				<img src={brandLogo} alt="" aria-hidden="true" />
			</span>
			<div className="top-header-actions">
				<span
					className="top-header-role"
					aria-hidden={isCompact}
				>
					{roleLabel}
				</span>
				<Link
					to={profile?.role === "photographer" ? "/photographer/settings" : "/client/profile"}
					className="top-header-profile"
					aria-label="Open profile"
					title="Open profile"
				>
					<BiUser size={24} aria-hidden="true" />
				</Link>
			</div>
		</header>
	);
}

export default Header;

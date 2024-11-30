import {Composer} from "./types";


const composers: Composer[] = [
	{
		name: "Bach",
		yearBorn: 1685,
		yearDied: 1750
	},
	{
		name: "Balakirev",
		yearBorn: 1837,
		yearDied: 1910
	},
	{
		name: "Beethoven",
		yearBorn: 1770,
		yearDied: 1827
	},
	{
		name: "Brahms",
		yearBorn: 1833,
		yearDied: 1897
	},
	{
		name: "Chopin",
		yearBorn: 1810,
		yearDied: 1849
	},
	{
		name: "Debussy",
		yearBorn: 1862,
		yearDied: 1918

	},
	{
		name: "Glinka",
		yearBorn: 1804,
		yearDied: 1857
	},
	{
		name: "Haydn",
		yearBorn: 1732,
		yearDied: 1809
	},
	{
		name: "Liszt",
		yearBorn: 1811,
		yearDied: 1886
	},
	{
		name: "Mozart",
		yearBorn: 1756,
		yearDied: 1791
	},
	{
		name: "Prokofiev",
		yearBorn: 1891,
		yearDied: 1953
	},
	{
		name: "Rachmaninoff",
		yearBorn: 1873,
		yearDied: 1943
	},
	{
		name: "Ravel",
		yearBorn: 1875,
		yearDied: 1937
	},
	{
		name: "Schubert",
		yearBorn: 1797,
		yearDied: 1828
	},
	{
		name: "Schumann",
		yearBorn: 1810,
		yearDied: 1856
	},
	{
		name: "Scriabin",
		yearBorn: 1872,
		yearDied: 1915
	}
];

/**
 * Looks up composer by case-insensitive comparison.
 * Throws error if composer is not found
 * @param name
 */
export function getComposer(name: string): Composer | undefined {
	const composer = composers.find(composer => composer.name.toLowerCase() === name.toLowerCase());
	if (composer === undefined) {
		throw (new Error(`Composer ${name} not found.`));
	}
	return composer;
}
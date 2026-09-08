"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIRouteAnalysis = generateAIRouteAnalysis;
function generateAIRouteAnalysis(routes, sourceName, destName) {
    if (!routes || routes.length === 0) {
        return {
            overview: `No feasible routes found between ${sourceName} and ${destName}. Check for road blockages.`,
            insights: [],
            generatedAt: new Date().toISOString(),
        };
    }
    // Find minimum time & distance for comparative analysis
    const times = routes.map(r => r.estimatedTimeMin);
    const dists = routes.map(r => r.distanceKm);
    const minTime = Math.min(...times);
    const minDist = Math.min(...dists);
    const insights = routes.map(r => {
        const isFastest = r.estimatedTimeMin === minTime;
        const isShortest = r.distanceKm === minDist;
        const hasDamagedSeg = r.segments.some(s => s.entityState === 'DAMAGED');
        const hasStaleSeg = r.segments.some(s => s.entityState === 'OPEN' && s.penaltyMultiplier > 1.0);
        const advantages = [];
        const disadvantages = [];
        const potentialConcerns = [];
        // Advantages
        if (isFastest)
            advantages.push(`Fastest estimated arrival time (${r.estimatedTimeMin.toFixed(1)} min)`);
        if (isShortest)
            advantages.push(`Shortest physical distance (${r.distanceKm} km)`);
        if (r.traffic === 'low')
            advantages.push('Uncongested traffic flow with high average speed');
        if (r.safety === 'safe')
            advantages.push('All segments verified open and structurally sound');
        // Disadvantages
        if (!isFastest)
            disadvantages.push(`Takes +${(r.estimatedTimeMin - minTime).toFixed(1)} min longer than fastest alternative`);
        if (!isShortest)
            disadvantages.push(`Extends distance by +${(r.distanceKm - minDist).toFixed(1)} km`);
        if (r.traffic === 'heavy')
            disadvantages.push('Heavy congestion slowdown along major corridors');
        if (r.safety === 'dangerous')
            disadvantages.push('Passes near damaged infrastructure or hazard zones');
        // Potential Concerns
        if (hasDamagedSeg) {
            potentialConcerns.push('Traverses segments reported as DAMAGED; structural risk present');
        }
        if (hasStaleSeg) {
            potentialConcerns.push('Traverses unverified stale infrastructure; field confirmation recommended');
        }
        if (r.traffic === 'moderate') {
            potentialConcerns.push('Moderate congestion expected near central intersections');
        }
        if (potentialConcerns.length === 0) {
            potentialConcerns.push('No critical hazards detected along this route');
        }
        // Summary & Preferable context
        let summary = `Route ${r.routeId}: ${r.distanceKm} km • ${r.estimatedTimeMin.toFixed(1)} min. Traffic: ${r.traffic.toUpperCase()}, Safety: ${r.safety.toUpperCase()}.`;
        let preferableWhen = '';
        if (isFastest && r.safety === 'safe') {
            preferableWhen = 'Ideal for time-critical emergency responders when safety is fully verified.';
        }
        else if (r.safety === 'safe' && !isFastest) {
            preferableWhen = 'Preferable for heavy logistics or patient transport prioritizing maximum safety over speed.';
        }
        else if (hasDamagedSeg) {
            preferableWhen = 'Use only as backup if primary crossings become completely impassable.';
        }
        else {
            preferableWhen = 'Recommended alternative if primary routes encounter sudden traffic delays.';
        }
        return {
            routeId: r.routeId,
            summary,
            advantages: advantages.length > 0 ? advantages : ['Alternative transit corridor'],
            disadvantages: disadvantages.length > 0 ? disadvantages : ['Slightly longer distance'],
            potentialConcerns,
            preferableWhen,
        };
    });
    const overview = `Analyzed ${routes.length} candidate emergency routes from ${sourceName} to ${destName}. ` +
        `Fastest option is ${minTime.toFixed(1)} min (${minDist} km). Decision support metrics are provided below; ` +
        `select the route best suited to current operational priority.`;
    return {
        overview,
        insights,
        generatedAt: new Date().toISOString(),
    };
}

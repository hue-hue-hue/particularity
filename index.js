var gramophone = require('gramophone');
var fs = require('fs');
var Regex = require("regex");
var _ = require('underscore');

//normalize scores between 0 and 1
//check percentile calculation on wordPercentile

var wordList = function(data){ //returns list of cleaned words
	var newData = data + ''
	return _.without(newData.split(" "), '')
}

var wordCount = function(data){ //returns list of non-stopWords and their counts
	var cleanWords = wordList(data)
	var notStopWords = gramophone.extract(data, {ngrams: [1], min: 1})
	var newDict = {}
	for (i=0; i<notStopWords.length; i++){
		newDict[notStopWords[i]] = 0
	}
	for (i = 0; i < cleanWords.length; i++) {
		if (cleanWords[i] in newDict) {
			newDict[cleanWords[i]] +=1
		}
	}; return newDict 
}

var wordFrequency = function(data) { //returns non-stopWords & ngrams and their frequencies (counts / total # of words)
	var ngramList = gramophone.extract(data, {ngrams: [1], min: 1}).concat(gramophone.extract(data, {ngrams: [2], min: 1}))
	var freqDict = {}
	for (i = 0; i<ngramList.length; i++){
		var searchTerm = new RegExp(ngramList[i], "g")
		var count = (data.match(searchTerm) || []).length
		if (count > 0){
			freqDict[ngramList[i]] = count/data.split(" ").length
		}
	}
	return freqDict
}

var frequencyIndex = function(data){ //returns non-stopWords & ngrams and their index
	var wordFrequencyDict = wordFrequency(data)
	var commonWordsFrequency = JSON.parse(fs.readFileSync('/Users/jenny/Desktop/urop/google-words-database/common-words-by-frequency.json', 'ascii'))
	indexDict = {}
	for (i = 0; i<Object.keys(wordFrequencyDict).length; i++){
		if (Object.keys(wordFrequencyDict)[i].split(" ").length > 1){ //for bigrams, use the average of 2 frequencies
			indexDict[Object.keys(wordFrequencyDict)[i]] = wordFrequencyDict[Object.keys(wordFrequencyDict)[i]] - 0.5*(parseFloat(commonWordsFrequency[Object.keys(wordFrequencyDict)[i].split(" ")[0].toUpperCase()]) + parseFloat(commonWordsFrequency[Object.keys(wordFrequencyDict)[i].split(" ")[1].toUpperCase()]))
		} else { //otherwise for single words
			if (String(Object.keys(wordFrequencyDict)[i]).toUpperCase() in commonWordsFrequency){
				indexDict[Object.keys(wordFrequencyDict)[i]] = (wordFrequencyDict[Object.keys(wordFrequencyDict)[i]] - commonWordsFrequency[Object.keys(wordFrequencyDict)[i].toUpperCase()])
			} else {
				indexDict[Object.keys(wordFrequencyDict)[i]] = 1.0
			}
		}
	} 
	for (i = 0; i<Object.keys(wordFrequencyDict).length; i++){
		if (isNaN(indexDict[Object.keys(wordFrequencyDict)[i]]) == true){
			indexDict[Object.keys(wordFrequencyDict)[i]] = 1.0
		}
	}
	return indexDict
}

var wordPercentile = function(data){ //returns non-stopWords and their percentile
	var cleanWords = wordList(data)
	var items = wordCount(data)
	var valuesList = []; //VALUESLIST is a list of values (not unique)

	for (i=0; i < Object.keys(items).length; i ++){
		valuesList.push(items[Object.keys(items)[i]]);
	}
	
	var valuesDict = {}; //VALUESDICT will match frequencies with percentiles --> {'1' : .63, '2': .12 ..etc..}
	for (i = 0; i<valuesList.length; i++){
		if (valuesList[i] in valuesDict){
			valuesDict[valuesList[i]] += 1
		} else {
			valuesDict[valuesList[i]] = 1
		};
	};
	var runningCount = 0
	for (i = 0; i<_.uniq(valuesList).length; i++){
		runningCount += ((valuesDict[_.uniq(valuesList)[_.uniq(valuesList).length - i - 1]]) * (_.uniq(valuesList)[_.uniq(valuesList).length - i - 1]))
		valuesDict[_.uniq(valuesList)[_.uniq(valuesList).length - i - 1]] = runningCount
	}
	for (i = 0; i<_.uniq(valuesList).length; i++){
		valuesDict[_.uniq(valuesList)[_.uniq(valuesList).length - i - 1]] /= cleanWords.length
	}
	var percentileDict = {}; //PERCENTILEDICT {'word': percentile}
	for (i = 0; i<Object.keys(items).length; i++){
		percentileDict[Object.keys(items)[i]] = (valuesDict[items[Object.keys(items)[i]]])
	};
	return percentileDict 
};

var percentileIndex = function(data){ //returns non-stopWords and their index
	percentileDict = wordPercentile(data)
	var commonWordsPercentile = JSON.parse(fs.readFileSync('/Users/jenny/Desktop/urop/google-words-database/percentiles.json', 'ascii'))
	indexDict = {}
	for (i = 0; i<Object.keys(percentileDict).length; i++){
		if (String(Object.keys(percentileDict)[i]).toUpperCase() in commonWordsPercentile){
			indexDict[Object.keys(percentileDict)[i]] = (percentileDict[Object.keys(percentileDict)[i]] - commonWordsPercentile[Object.keys(percentileDict)[i].toUpperCase()] + .5)
		} else {
			indexDict[Object.keys(percentileDict)[i]] = 1.0
		}
	} 
	return indexDict
} 

var gramophonePercentileIndex = function(data){ //returns non-stopWords & ngrams and their index
	var ngramList = gramophone.extract(data, {ngrams: [1], min: 1}).concat(gramophone.extract(data, {ngrams: [2], min: 1}))
	var gramophoneDict = {}
	var percentileDict = percentileIndex(data)
	for (i=0; i<ngramList.length; i++){
		if (ngramList[i].split(" ").length == 1) {
			gramophoneDict[ngramList[i]] = percentileDict[ngramList[i]]
		} else {
			gramophoneDict[ngramList[i]] = percentileDict[ngramList[i].split(" ")[0]] * percentileDict[ngramList[i].split(" ")[1]]
		}

	} return gramophoneDict 
}

var weights = function(data, ngram){ //find weight array of a particular ngram
	var frequencyDict = frequencyIndex(data) 
	var percentilesDict = gramophonePercentileIndex(data)
	var wordsInNgram = ngram.split(' ')
	var weights = {}
	for (i = 0; i<wordsInNgram.length; i++){ 
		weights[wordsInNgram[i]] = {}
		weights[wordsInNgram[i]].frequencyIndex = frequencyDict[wordsInNgram[i]]
		weights[wordsInNgram[i]].percentileIndex = percentilesDict[wordsInNgram[i]]
	}
	return weights
} 

var calculateScore = function(data, ngram, scale) {//calculate score of an ngram
	if (scale == undefined){
		var scale = .5
	}
	var wordsInNgram = ngram.split(' ')
	var ngramArray = weights(data, ngram)
	var score = 0
	for (i = 0; i<wordsInNgram.length; i++){
		score += ((scale*ngramArray[wordsInNgram[i]].frequencyIndex) + (1-scale) * (ngramArray[wordsInNgram[i]].percentileIndex))
	}
	return score/wordsInNgram.length
}

var data = ''
var ngramList = {}
exports.buildData = function(filepath){ //get a clean string for finding ngrams
	data = fs.readFileSync(filepath, 'ascii').toLowerCase().replace(/[^a-zA-Z\d\-\s:]/g, "").replace(/[-]/g, " ").replace(/\n/g, " ")
	return data
}

exports.getNgrams = function(){
	ngramList = gramophone.extract(data, {ngrams: [1], min: 1}).concat(gramophone.extract(data, {ngrams: [2], min: 1}))
	return ngramList
}

exports.getScore = function(ngram, scale){ //get the score of one ngram
	if (scale == undefined){
		var scale = .5
	} 	
	if (ngram in ngramList){
		return calculateScore(data, ngram, scale)
	} else{
		return "not a valid ngram"
	}
}
exports.getScores = function(scale){ //get the score of all ngrams
	if (scale == undefined){
		var scale = .5
	}
	var scoreDict = {}
	for (i=0; i<Object.keys(ngramList).length; i++){
		//scoreDict[Object.keys(ngramList)[i]] = calculateScore(data, Object.keys(ngramList)[i], scale)
		console.log(calculateScore(data, Object.keys(ngramList)[i]))
	}
	return scoreDict
}

